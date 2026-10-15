import "server-only";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { schema, type Tx } from "@/db/client";
import { deriveEstate } from "@/lib/derive";
import {
  MILESTONES,
  type AssetTax,
  type AuditEntry,
  type Estate,
  type IntestacyFamilyRecord,
  type MilestoneKey,
  type Party,
  type StaffMember,
  type Task,
  type TaxProfile,
} from "@/lib/types";

/**
 * Reads and writes the estate record in its normalised tables.
 *
 * The screens work with `Estate` objects (src/lib/types.ts). `loadEstates`
 * assembles them from the tables; `saveEstate` takes the estate before and
 * after an action and writes only the rows that changed, matched on each
 * row's per-estate `key`. Both run inside withTenant(), so row-level security
 * decides what is visible and writable: a family member's estate simply has
 * no firm-only rows (notes, drafts...) to load or change.
 */

type Row<T extends keyof typeof schema> = (typeof schema)[T] extends { $inferSelect: infer R } ? R : never;

const iso = (d: Date | string | null | undefined) => (d == null ? undefined : typeof d === "string" ? d : d.toISOString());
const day = (d: string | null | undefined) => (d == null ? null : d.slice(0, 10));

function group<T extends { estateId: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const list = m.get(r.estateId);
    if (list) list.push(r);
    else m.set(r.estateId, [r]);
  }
  return m;
}

export interface LoadContext {
  staff: StaffMember[];
  /** user id → membership id, for mapping audit actors. */
  staffByUser: Map<string, string>;
  /** Firm scope reads the audit trail and the IHT tables; the portal can't (RLS) and skips them. */
  scope: "firm" | "portal";
  now?: Date;
}

/** All visible estates (not archived), oldest first, with derived fields computed. */
export async function loadEstates(tx: Tx, ctx: LoadContext): Promise<{ estates: Estate[]; uuidBySlug: Map<string, string> }> {
  const rows = await tx.select().from(schema.estate).where(ne(schema.estate.status, "archived")).orderBy(asc(schema.estate.openedAt), asc(schema.estate.ref));
  const uuidBySlug = new Map(rows.map((r) => [r.slug, r.id]));
  if (!rows.length) return { estates: [], uuidBySlug };
  const ids = rows.map((r) => r.id);
  const inEstates = <T extends { estateId: unknown }>(t: T) => inArray(t.estateId as never, ids);

  const [parties, staffRows, milestones, wills, gifts, holdings, tasks, documents, extractions, drafts, missing, messages, updates, notes, profiles, lifetimeGifts, priorTransfers, holdingTaxes, partyTaxes] = await Promise.all([
    tx.select().from(schema.estateParty).where(inEstates(schema.estateParty)).orderBy(asc(schema.estateParty.createdAt)),
    tx
      .select({ s: schema.estateStaff, role: schema.membership.role, title: schema.membership.title, initials: schema.membership.initials, color: schema.membership.color, name: schema.user.name })
      .from(schema.estateStaff)
      .innerJoin(schema.membership, eq(schema.membership.id, schema.estateStaff.membershipId))
      .innerJoin(schema.user, eq(schema.user.id, schema.membership.userId))
      .where(inEstates(schema.estateStaff))
      .orderBy(asc(schema.estateStaff.createdAt)),
    tx.select().from(schema.milestone).where(inEstates(schema.milestone)),
    tx.select().from(schema.will).where(inEstates(schema.will)),
    tx.select().from(schema.willGift).where(inEstates(schema.willGift)).orderBy(asc(schema.willGift.position)),
    tx.select().from(schema.holding).where(inEstates(schema.holding)).orderBy(asc(schema.holding.position), asc(schema.holding.createdAt)),
    tx.select().from(schema.task).where(inEstates(schema.task)).orderBy(asc(schema.task.createdAt), asc(schema.task.key)),
    tx.select().from(schema.document).where(inEstates(schema.document)).orderBy(asc(schema.document.position), asc(schema.document.createdAt)),
    tx.select().from(schema.extraction).where(inEstates(schema.extraction)).orderBy(asc(schema.extraction.createdAt)),
    tx.select().from(schema.draft).where(inEstates(schema.draft)).orderBy(asc(schema.draft.createdAt)),
    tx.select().from(schema.missingItem).where(inEstates(schema.missingItem)).orderBy(asc(schema.missingItem.position)),
    tx.select().from(schema.message).where(inEstates(schema.message)).orderBy(asc(schema.message.sentAt)),
    tx.select().from(schema.clientUpdate).where(inEstates(schema.clientUpdate)).orderBy(asc(schema.clientUpdate.postedAt)),
    tx.select().from(schema.note).where(inEstates(schema.note)).orderBy(asc(schema.note.createdAt)),
    // IHT tables are firm-only: in portal scope RLS returns no rows.
    tx.select().from(schema.ihtProfile).where(inEstates(schema.ihtProfile)),
    tx.select().from(schema.lifetimeGift).where(inEstates(schema.lifetimeGift)).orderBy(asc(schema.lifetimeGift.madeOn), asc(schema.lifetimeGift.createdAt)),
    tx.select().from(schema.priorTransfer).where(inEstates(schema.priorTransfer)).orderBy(asc(schema.priorTransfer.createdAt)),
    tx.select().from(schema.holdingTax).where(inEstates(schema.holdingTax)),
    tx.select().from(schema.partyTax).where(inEstates(schema.partyTax)),
  ]);
  const firm = ctx.scope === "firm";
  const holdingTaxBy = new Map(holdingTaxes.map((x) => [x.holdingId, x]));
  const partyTaxBy = new Map(partyTaxes.map((x) => [x.partyId, x.category]));

  // The audit trail on screen is the real, append-only log (latest 50 per estate).
  const auditByEstate = new Map<string, AuditEntry[]>();
  if (firm) {
    const audit = (await tx.execute(sql`
      select estate_id, id, created_at, actor_type, actor_user_id, summary from (
        select estate_id, id, created_at, actor_type, actor_user_id, summary,
          row_number() over (partition by estate_id order by seq desc) as rn
        from audit_event where estate_id in ${ids}
      ) a where rn <= 50 order by created_at desc`)) as unknown as Array<{ estate_id: string; id: number; created_at: string | Date; actor_type: string; actor_user_id: string | null; summary: string }>;
    for (const a of audit) {
      const list = auditByEstate.get(a.estate_id) ?? [];
      list.push({ id: `au_${a.id}`, at: iso(a.created_at)!, actor: a.actor_type === "ai" ? "ai" : a.actor_type === "system" ? "system" : a.actor_user_id ?? "system", text: a.summary });
      auditByEstate.set(a.estate_id, list);
    }
  }

  const P = group(parties);
  const S = group(staffRows.map((r) => ({ ...r, estateId: r.s.estateId })));
  const M = group(milestones);
  const W = new Map(wills.map((w) => [w.estateId, w]));
  const G = group(gifts);
  const H = group(holdings);
  const T = group(tasks);
  const D = group(documents);
  const X = group(extractions);
  const R = group(drafts);
  const I = group(missing);
  const Ms = group(messages);
  const U = group(updates);
  const N = group(notes);
  const Prof = new Map(profiles.map((x) => [x.estateId, x]));
  const LG = group(lifetimeGifts);
  const PT = group(priorTransfers);

  const estates = rows.map((r) => {
    // Main executor first, then everyone else in the order they were added.
    const ps = [...(P.get(r.id) ?? [])].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
    const partyKey = new Map(ps.map((p) => [p.id, p.key]));
    const partyKeyByUser = new Map(ps.filter((p) => p.userId).map((p) => [p.userId!, p.key]));
    const taskKey = new Map((T.get(r.id) ?? []).map((t) => [t.id, t.key]));
    const staffKeyByMembership = new Map((S.get(r.id) ?? []).map((x) => [x.s.membershipId, x.s.key]));
    const docKey = new Map((D.get(r.id) ?? []).map((d) => [d.id, d.key]));
    const holdingKey = new Map((H.get(r.id) ?? []).map((h) => [h.id, h.key]));
    const prof = Prof.get(r.id);
    // Firm scope always gets a tax profile (defaults until one is saved); the portal never does.
    const tax: TaxProfile | undefined = firm
      ? {
          longTermUkResident: prof?.longTermUkResident ?? true,
          spouseExemptionLimited: prof?.spouseExemptionLimited ?? false,
          transferredNrbBp: prof?.transferredNrbBp ?? 0,
          transferredRnrbBp: prof?.transferredRnrbBp ?? 0,
          predeceasedSpouse: prof?.predeceasedSpouseName ? { name: prof.predeceasedSpouseName, diedOn: prof.predeceasedSpouseDiedOn ?? undefined } : undefined,
          downsizing:
            prof?.downsizingDisposedOn && prof.downsizingFormerValuePence !== null
              ? { disposedOn: prof.downsizingDisposedOn, formerResidenceValuePence: prof.downsizingFormerValuePence }
              : undefined,
          reliefAllowanceTransferredPence: prof?.reliefAllowanceTransferredPence ?? undefined,
          residueBenham: prof?.residueBenham ?? false,
          mergeCharityComponents: prof?.mergeCharityComponents ?? false,
          intestacyFamily: (prof?.intestacyFamily as IntestacyFamilyRecord | null) ?? undefined,
          confirmations: (prof?.confirmations as TaxProfile["confirmations"] | undefined) ?? {},
          gifts: (LG.get(r.id) ?? []).map((g) => ({
            id: g.key,
            madeOn: g.madeOn,
            valuePence: g.valuePence,
            description: g.description,
            recipientPartyId: g.recipientPartyId ? partyKey.get(g.recipientPartyId) : undefined,
            recipientName: g.recipientName ?? undefined,
            recipientCategory: g.recipientCategory,
            form: g.form,
            lifetimeTaxPaidPence: g.lifetimeTaxPaidPence ?? undefined,
            smallGift: g.smallGift || undefined,
            weddingGift: g.weddingGift ?? undefined,
            normalExpenditure: g.normalExpenditure || undefined,
            relief: g.reliefKind && g.reliefRate ? { kind: g.reliefKind, rate: g.reliefRate, stillQualifiesAtDeath: g.reliefStillQualifies } : undefined,
            voided: g.voidedAt ? true : undefined,
          })),
          priorTransfers: (PT.get(r.id) ?? []).map((p) => ({
            id: p.key,
            label: p.label,
            transferOn: p.transferOn,
            netIncreasePence: p.netIncreasePence,
            grossTransferPence: p.grossTransferPence,
            taxPaidPence: p.taxPaidPence,
            voided: p.voidedAt ? true : undefined,
          })),
        }
      : undefined;
    const primary = ps.find((p) => p.isPrimary) ?? ps.find((p) => p.role === "executor") ?? ps[0];

    const familyParties: Party[] = ps.map((p) => ({
      id: p.key,
      name: p.fullName,
      initials: p.initials,
      role: p.role,
      relationship: p.relationship ?? undefined,
      detail: p.detail ?? undefined,
      email: p.email ?? undefined,
      color: p.color,
      portalStatus: p.acceptedAt ? "active" : p.invitedAt ? "invited" : "not_invited",
      taxCategory: (firm && partyTaxBy.get(p.id)) || undefined,
    }));
    const staffParties: Party[] = (S.get(r.id) ?? []).map((x) => ({
      id: x.s.key,
      name: x.name,
      initials: x.initials,
      role: x.role === "paralegal" ? "paralegal" : "solicitor",
      detail: x.s.detail ?? undefined,
      color: x.color,
      staffId: x.s.membershipId,
    }));

    const milestoneMap: Partial<Record<MilestoneKey, string>> = {};
    for (const m of M.get(r.id) ?? []) milestoneMap[m.key] = m.reachedOn;

    const w = W.get(r.id);
    const audit = (auditByEstate.get(r.id) ?? []).map((a) => {
      if (a.actor === "ai" || a.actor === "system") return a;
      const staff = ctx.staffByUser.get(a.actor);
      return { ...a, actor: staff ?? partyKeyByUser.get(a.actor) ?? "system" };
    });

    const estate = {
      id: r.slug,
      ref: r.ref,
      deceased: {
        firstName: r.deceasedFirstName,
        fullName: r.deceasedFullName,
        shortName: r.deceasedShortName,
        aliases: r.deceasedAliases.length ? r.deceasedAliases : undefined,
        dateOfBirth: r.dateOfBirth ?? undefined,
        dateOfDeath: r.dateOfDeath,
        placeOfDeath: r.placeOfDeath ?? undefined,
        maritalStatus: r.maritalStatus ?? undefined,
      },
      serviceLevel: r.serviceLevel,
      openedAt: iso(r.openedAt)!,
      milestones: milestoneMap,
      will: w
        ? {
            dated: w.datedOn,
            originalHeld: w.originalHeld,
            location: w.location ?? undefined,
            codicils: w.codicils,
            gifts: (G.get(r.id) ?? []).map((g) => ({
              id: g.key,
              kind: g.kind,
              beneficiaryPartyId: g.beneficiaryPartyId ? partyKey.get(g.beneficiaryPartyId) : undefined,
              description: g.description,
              amountPence: g.amountPence ?? undefined,
              shareBp: g.shareBp ?? undefined,
              substitution: g.substitution ?? undefined,
              assetId: g.holdingId ? holdingKey.get(g.holdingId) : undefined,
              bearsOwnTax: g.bearsOwnTax || undefined,
            })),
          }
        : undefined,
      feeEarnerId: r.feeEarnerId ?? "",
      clientPartyId: primary?.key ?? "",
      funeralEstimatePence: r.funeralEstimatePence,
      parties: [...familyParties, ...staffParties],
      tasks: (T.get(r.id) ?? [])
        .map((t): Task => ({
          id: t.key,
          title: t.title,
          owner:
            t.ownerKind === "firm"
              ? { kind: "firm", staffId: t.ownerMembershipId ?? "" }
              : t.ownerKind === "family"
                ? { kind: "family", partyId: (t.ownerPartyId && partyKey.get(t.ownerPartyId)) || "" }
                : { kind: "third", label: t.ownerLabel ?? "", category: t.thirdPartyCategory ?? "other" },
          dueOn: t.dueOn,
          done: t.doneAt !== null,
          doneAt: iso(t.doneAt),
          createdAt: iso(t.createdAt)!,
          sourceRule: t.sourceRule ?? undefined,
        }))
        .reverse(),
      assets: (H.get(r.id) ?? []).map((h) => ({
        id: h.key,
        kind: h.kind,
        name: h.name,
        clientName: h.clientName ?? undefined,
        institution: h.institutionLabel,
        reference: h.reference ?? undefined,
        state: h.state,
        valuePence: h.valuePence,
        liability: h.liability,
        addedBy: h.addedBy,
        nextAction: h.nextAction === "valuation" ? ("valuation" as const) : undefined,
        nextActionOn: h.nextActionOn ?? undefined,
        tax: firm ? holdingTax(holdingTaxBy.get(h.id), partyKey, holdingKey) : undefined,
      })),
      documents: (D.get(r.id) ?? []).map((d) => ({
        id: d.key,
        name: d.name,
        hint: d.hint ?? undefined,
        icon: d.icon,
        state: d.state,
        copies: d.copies ?? undefined,
        uploadedBy: d.uploadedByPartyId
          ? partyKey.get(d.uploadedByPartyId)
          : d.uploadedByMembershipId
            ? (staffKeyByMembership.get(d.uploadedByMembershipId) ?? d.uploadedByMembershipId)
            : undefined,
        uploadedAt: iso(d.uploadedAt),
        fileName: d.fileName ?? undefined,
        fileId: d.fileId ?? undefined,
      })),
      audit,
      notes: (N.get(r.id) ?? []).map((n) => ({ id: n.key, text: n.body, author: n.authorMembershipId ?? "", at: iso(n.createdAt)! })).reverse(),
      drafts: (R.get(r.id) ?? [])
        .map((d) => ({
          id: d.key,
          kind: d.kind as "letter" | "email",
          title: d.title,
          to: d.toLabel,
          re: d.re,
          body: d.body as string[],
          signOff: d.signOff,
          sources: d.sources,
          status: d.status,
          edited: d.edited || undefined,
          createdAt: iso(d.createdAt)!,
          decidedAt: iso(d.decidedAt),
          taskId: d.taskId ? taskKey.get(d.taskId) : undefined,
          clientUpdate: (d.clientUpdate as { title: string; body: string } | null) ?? undefined,
        }))
        .reverse(),
      extractions: (X.get(r.id) ?? []).map((x) => ({
        id: x.key,
        documentId: docKey.get(x.documentId) ?? "",
        fileName: x.fileName,
        fields: x.fields as Estate["extractions"][number]["fields"],
        assetId: x.holdingId ? holdingKey.get(x.holdingId) : undefined,
        status: x.status,
      })),
      missing: (I.get(r.id) ?? []).map((m) => ({
        id: m.key,
        title: m.title,
        body: m.body,
        action: m.actionLabel,
        actionKind: m.actionKind as Estate["missing"][number]["actionKind"],
        tone: m.tone,
        resolved: m.resolvedAt ? true : undefined,
      })),
      messages: (Ms.get(r.id) ?? []).map((m) => ({
        id: m.key,
        from: m.side,
        authorId: m.side === "client" ? ((m.authorPartyId && partyKey.get(m.authorPartyId)) || "") : (m.authorMembershipId ?? ""),
        text: m.body,
        sentAt: iso(m.sentAt)!,
        attachment: m.attachmentName ?? undefined,
      })),
      updates: (U.get(r.id) ?? [])
        .map((u) => ({ id: u.key, at: iso(u.postedAt)!, title: u.title, body: u.body, tone: u.tone, milestone: u.isMilestone || undefined }))
        .reverse(),
      tax,
      todayStep: (r.todayStep as Estate["todayStep"]) ?? undefined,
    };
    return deriveEstate(estate, ctx.now);
  });

  return { estates, uuidBySlug };
}

/** A holding's IHT columns as the screens' `AssetTax` (undefined when all default). */
function holdingTax(h: Row<"holdingTax"> | undefined, partyKey: Map<string, string>, holdingKey: Map<string, string>): AssetTax | undefined {
  if (!h) return undefined;
  const t: AssetTax = {};
  if (h.ownership !== "sole") t.ownership = h.ownership;
  if (h.survivorPartyId) t.survivorPartyId = partyKey.get(h.survivorPartyId);
  if (h.qualifyingResidence) t.qualifyingResidence = true;
  if (h.reliefKind && h.reliefRate) t.relief = { kind: h.reliefKind, rate: h.reliefRate };
  if (h.pensionTreatment) t.pension = h.pensionTreatment;
  if (h.pensionRecipientPartyId) t.pensionRecipientPartyId = partyKey.get(h.pensionRecipientPartyId);
  if (h.foreign) t.foreign = true;
  if (h.securedOnHoldingId) t.securedOnAssetId = holdingKey.get(h.securedOnHoldingId);
  if (!h.deductible) t.deductible = false;
  return Object.keys(t).length ? t : undefined;
}

// ── Saving ──────────────────────────────────────────────────────────────────

export interface SaveContext {
  firmId: string;
  estateUuid: string;
  /** Membership id of the acting staff member (null for family). */
  actorMembershipId: string | null;
  actorUserId: string;
  /** Only firm scope writes the IHT tables (families never receive them, so they'd look cleared). */
  scope: "firm" | "portal";
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Items in `after` that are new or changed compared with `before`, matched by id (the row key). */
function changed<T extends { id: string }>(before: T[] | undefined, after: T[]): { item: T; isNew: boolean; index: number }[] {
  const prev = new Map((before ?? []).map((x) => [x.id, x]));
  const out: { item: T; isNew: boolean; index: number }[] = [];
  after.forEach((item, index) => {
    const p = prev.get(item.id);
    if (!p) out.push({ item, isNew: true, index });
    else if (!same(p, item)) out.push({ item, isNew: false, index });
  });
  return out;
}

/** key → uuid for rows of one table in this estate that the current scope can see. */
async function keyMap(tx: Tx, table: { id: unknown; key: unknown; estateId: unknown }, estateUuid: string): Promise<Map<string, string>> {
  const t = table as unknown as typeof schema.task;
  const rows = await tx.select({ id: t.id, key: t.key }).from(t).where(eq(t.estateId, estateUuid));
  return new Map(rows.map((r) => [r.key, r.id]));
}

/**
 * Write the difference between `before` (null for a new estate) and `after`.
 * Never deletes: the reducer never removes records, and the database grants
 * the app no DELETE on estate tables.
 */
export async function saveEstate(tx: Tx, ctx: SaveContext, before: Estate | null, after: Estate): Promise<void> {
  const base = { firmId: ctx.firmId, estateId: ctx.estateUuid };
  const where = (t: { estateId: unknown; key: unknown }, key: string) =>
    and(eq(t.estateId as typeof schema.task.estateId, ctx.estateUuid), eq(t.key as typeof schema.task.key, key));

  // Parties (family). Staff parties are estate_staff rows.
  const partyIds = await keyMap(tx, schema.estateParty, ctx.estateUuid);
  for (const { item: p, isNew } of changed(before?.parties, after.parties)) {
    if (p.staffId) {
      if (isNew) {
        await tx
          .insert(schema.estateStaff)
          .values({ ...base, membershipId: p.staffId, key: p.id, detail: p.detail ?? null })
          .onConflictDoNothing();
      }
      continue;
    }
    const values = {
      fullName: p.name,
      initials: p.initials,
      role: (p.role === "solicitor" || p.role === "paralegal" ? "other" : p.role) as Row<"estateParty">["role"],
      relationship: p.relationship ?? null,
      detail: p.detail ?? null,
      email: p.email?.toLowerCase() ?? null,
      color: p.color,
    };
    if (isNew) {
      const id = crypto.randomUUID();
      await tx.insert(schema.estateParty).values({ id, ...base, key: p.id, isPrimary: p.id === after.clientPartyId, ...values, invitedAt: p.portalStatus === "invited" ? new Date() : null });
      partyIds.set(p.id, id);
    } else {
      await tx.update(schema.estateParty).set(values).where(where(schema.estateParty, p.id));
    }
  }

  // Milestones.
  for (const k of MILESTONES) {
    const a = after.milestones[k];
    const b = before?.milestones[k];
    if (a && a !== b) {
      await tx
        .insert(schema.milestone)
        .values({ ...base, key: k, reachedOn: a })
        .onConflictDoUpdate({ target: [schema.milestone.estateId, schema.milestone.key], set: { reachedOn: a } });
    }
  }

  // Holdings (before the will and anything else that points at them).
  const holdingIds = await keyMap(tx, schema.holding, ctx.estateUuid);
  const changedAssets = changed(before?.assets, after.assets);
  for (const { item: a, isNew, index } of changedAssets) {
    const v = {
      kind: a.kind,
      name: a.name,
      clientName: a.clientName ?? null,
      institutionLabel: a.institution,
      reference: a.reference ?? null,
      state: a.state,
      valuePence: a.valuePence,
      liability: a.liability,
      addedBy: a.addedBy,
      nextAction: a.nextAction ?? null,
      nextActionOn: a.nextActionOn ?? null,
      position: index,
      updatedAt: new Date(),
    };
    if (isNew) {
      const id = crypto.randomUUID();
      await tx.insert(schema.holding).values({ id, ...base, key: a.id, ...v });
      holdingIds.set(a.id, id);
    } else await tx.update(schema.holding).set(v).where(where(schema.holding, a.id));
  }
  // How each holding is treated for IHT (firm only), now every holding has an id.
  if (ctx.scope === "firm") {
    const prevAssets = new Map((before?.assets ?? []).map((a) => [a.id, a]));
    for (const { item: a } of changedAssets) {
      if (same(prevAssets.get(a.id)?.tax, a.tax)) continue;
      const t = a.tax ?? {};
      const tv = {
        ownership: t.ownership ?? ("sole" as const),
        survivorPartyId: t.survivorPartyId ? (partyIds.get(t.survivorPartyId) ?? null) : null,
        qualifyingResidence: Boolean(t.qualifyingResidence),
        reliefKind: t.relief?.kind ?? null,
        reliefRate: t.relief?.rate ?? null,
        pensionTreatment: t.pension ?? null,
        pensionRecipientPartyId: t.pensionRecipientPartyId ? (partyIds.get(t.pensionRecipientPartyId) ?? null) : null,
        foreign: Boolean(t.foreign),
        securedOnHoldingId: t.securedOnAssetId ? (holdingIds.get(t.securedOnAssetId) ?? null) : null,
        deductible: t.deductible !== false,
        updatedAt: new Date(),
      };
      await tx
        .insert(schema.holdingTax)
        .values({ ...base, holdingId: holdingIds.get(a.id)!, ...tv })
        .onConflictDoUpdate({ target: schema.holdingTax.holdingId, set: tv });
    }
  }

  // Will and gifts.
  if (after.will && !same(before?.will, after.will)) {
    const w = after.will;
    const [existing] = await tx.select({ id: schema.will.id }).from(schema.will).where(eq(schema.will.estateId, ctx.estateUuid));
    const willId = existing?.id ?? crypto.randomUUID();
    const wv = { datedOn: w.dated, originalHeld: w.originalHeld, location: w.location ?? null, codicils: w.codicils };
    if (existing) await tx.update(schema.will).set(wv).where(eq(schema.will.id, willId));
    else await tx.insert(schema.will).values({ id: willId, ...base, ...wv });
    for (const { item: g, isNew, index } of changed(before?.will?.gifts, w.gifts)) {
      const gv = {
        kind: g.kind,
        beneficiaryPartyId: g.beneficiaryPartyId ? (partyIds.get(g.beneficiaryPartyId) ?? null) : null,
        description: g.description,
        amountPence: g.amountPence ?? null,
        shareBp: g.shareBp ?? null,
        substitution: g.substitution ?? null,
        holdingId: g.assetId ? (holdingIds.get(g.assetId) ?? null) : null,
        bearsOwnTax: Boolean(g.bearsOwnTax),
        position: index,
      };
      if (isNew) await tx.insert(schema.willGift).values({ ...base, willId, key: g.id, ...gv });
      else await tx.update(schema.willGift).set(gv).where(where(schema.willGift, g.id));
    }
  }

  // Documents.
  const docIds = await keyMap(tx, schema.document, ctx.estateUuid);
  // Staff appear as parties with a staffId; uploads by them store the membership.
  const membershipByStaffKey = new Map(after.parties.filter((p) => p.staffId).map((p) => [p.id, p.staffId!]));
  const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
  for (const { item: d, isNew, index } of changed(before?.documents, after.documents)) {
    const byParty = d.uploadedBy ? partyIds.get(d.uploadedBy) : undefined;
    const v = {
      name: d.name,
      hint: d.hint ?? null,
      icon: d.icon,
      state: d.state,
      copies: d.copies ?? null,
      fileId: d.fileId ?? null,
      fileName: d.fileName ?? null,
      uploadedByPartyId: byParty ?? null,
      uploadedByMembershipId: d.uploadedBy && !byParty ? (membershipByStaffKey.get(d.uploadedBy) ?? (isUuid(d.uploadedBy) ? d.uploadedBy : null)) : null,
      uploadedAt: d.uploadedAt ? new Date(d.uploadedAt) : null,
      position: index,
    };
    if (isNew) {
      const id = crypto.randomUUID();
      await tx.insert(schema.document).values({ id, ...base, key: d.id, ...v });
      docIds.set(d.id, id);
    } else await tx.update(schema.document).set(v).where(where(schema.document, d.id));
  }

  // Tasks.
  const taskIds = await keyMap(tx, schema.task, ctx.estateUuid);
  for (const { item: t, isNew } of changed(before?.tasks, after.tasks)) {
    const o = t.owner;
    const v = {
      title: t.title,
      ownerKind: o.kind,
      ownerMembershipId: o.kind === "firm" ? o.staffId || null : null,
      ownerPartyId: o.kind === "family" ? (partyIds.get(o.partyId) ?? null) : null,
      ownerLabel: o.kind === "third" ? o.label : null,
      thirdPartyCategory: o.kind === "third" ? o.category : null,
      dueOn: day(t.dueOn),
      doneAt: t.done ? new Date(t.doneAt ?? Date.now()) : null,
      doneBy: t.done ? ctx.actorUserId : null,
      sourceRule: t.sourceRule ?? null,
    };
    if (isNew) {
      const id = crypto.randomUUID();
      await tx.insert(schema.task).values({ id, ...base, key: t.id, ...v, createdAt: new Date(t.createdAt) });
      taskIds.set(t.id, id);
    } else await tx.update(schema.task).set(v).where(where(schema.task, t.id));
  }

  // Extractions.
  for (const { item: x, isNew } of changed(before?.extractions, after.extractions)) {
    const documentId = docIds.get(x.documentId);
    if (!documentId) continue;
    const v = {
      documentId,
      fileName: x.fileName,
      fields: x.fields,
      holdingId: x.assetId ? (holdingIds.get(x.assetId) ?? null) : null,
      status: x.status,
      decidedAt: x.status === "accepted" ? new Date() : null,
    };
    if (isNew) await tx.insert(schema.extraction).values({ ...base, key: x.id, ...v });
    else await tx.update(schema.extraction).set(v).where(where(schema.extraction, x.id));
  }

  // Drafts.
  for (const { item: d, isNew } of changed(before?.drafts, after.drafts)) {
    const v = {
      kind: d.kind,
      title: d.title,
      toLabel: d.to,
      re: d.re,
      body: d.body,
      signOff: d.signOff,
      sources: d.sources,
      status: d.status,
      edited: Boolean(d.edited),
      taskId: d.taskId ? (taskIds.get(d.taskId) ?? null) : null,
      clientUpdate: d.clientUpdate ?? null,
      decidedAt: d.decidedAt ? new Date(d.decidedAt) : null,
      decidedBy: d.decidedAt ? ctx.actorUserId : null,
    };
    if (isNew) await tx.insert(schema.draft).values({ ...base, key: d.id, ...v, createdAt: new Date(d.createdAt) });
    else await tx.update(schema.draft).set(v).where(where(schema.draft, d.id));
  }

  // Missing items.
  for (const { item: m, isNew, index } of changed(before?.missing, after.missing)) {
    const v = { title: m.title, body: m.body, actionLabel: m.action, actionKind: m.actionKind, tone: m.tone, resolvedAt: m.resolved ? new Date() : null, position: index };
    if (isNew) await tx.insert(schema.missingItem).values({ ...base, key: m.id, ...v });
    else await tx.update(schema.missingItem).set(v).where(where(schema.missingItem, m.id));
  }

  // Messages (append-only in practice).
  for (const { item: m, isNew } of changed(before?.messages, after.messages)) {
    if (!isNew) continue;
    await tx.insert(schema.message).values({
      ...base,
      key: m.id,
      side: m.from,
      authorPartyId: m.from === "client" ? (partyIds.get(m.authorId) ?? null) : null,
      authorMembershipId: m.from === "firm" ? m.authorId || null : null,
      body: m.text,
      attachmentName: m.attachment ?? null,
      sentAt: new Date(m.sentAt),
    });
  }

  // Client updates.
  for (const { item: u, isNew } of changed(before?.updates, after.updates)) {
    if (!isNew) continue;
    await tx.insert(schema.clientUpdate).values({ ...base, key: u.id, title: u.title, body: u.body, tone: u.tone, isMilestone: Boolean(u.milestone), postedAt: new Date(u.at) });
  }

  // Notes.
  for (const { item: n, isNew } of changed(before?.notes, after.notes)) {
    if (!isNew) continue;
    await tx.insert(schema.note).values({ ...base, key: n.id, body: n.text, authorMembershipId: n.author || null, createdAt: new Date(n.at) });
  }

  // Inheritance tax (firm scope only; families never send a tax profile).
  if (ctx.scope === "firm") {
    const prevParties = new Map((before?.parties ?? []).map((p) => [p.id, p]));
    for (const p of after.parties) {
      const partyId = partyIds.get(p.id);
      if (!partyId || (prevParties.get(p.id)?.taxCategory ?? null) === (p.taxCategory ?? null)) continue;
      const pv = { category: p.taxCategory ?? null, updatedAt: new Date() };
      await tx.insert(schema.partyTax).values({ ...base, partyId, ...pv }).onConflictDoUpdate({ target: schema.partyTax.partyId, set: pv });
    }
  }
  if (ctx.scope === "firm" && after.tax && !same(before?.tax, after.tax)) {
    const t = after.tax;
    const pv = {
      longTermUkResident: t.longTermUkResident,
      spouseExemptionLimited: t.spouseExemptionLimited,
      transferredNrbBp: t.transferredNrbBp,
      transferredRnrbBp: t.transferredRnrbBp,
      predeceasedSpouseName: t.predeceasedSpouse?.name ?? null,
      predeceasedSpouseDiedOn: t.predeceasedSpouse?.diedOn ?? null,
      downsizingDisposedOn: t.downsizing?.disposedOn ?? null,
      downsizingFormerValuePence: t.downsizing?.formerResidenceValuePence ?? null,
      reliefAllowanceTransferredPence: t.reliefAllowanceTransferredPence ?? null,
      residueBenham: t.residueBenham,
      mergeCharityComponents: t.mergeCharityComponents,
      intestacyFamily: t.intestacyFamily ?? null,
      confirmations: t.confirmations,
      updatedAt: new Date(),
    };
    await tx
      .insert(schema.ihtProfile)
      .values({ ...base, ...pv })
      .onConflictDoUpdate({ target: schema.ihtProfile.estateId, set: pv });
    for (const { item: g, isNew } of changed(before?.tax?.gifts, t.gifts)) {
      const gv = {
        madeOn: g.madeOn,
        valuePence: g.valuePence,
        description: g.description,
        recipientPartyId: g.recipientPartyId ? (partyIds.get(g.recipientPartyId) ?? null) : null,
        recipientName: g.recipientName ?? null,
        recipientCategory: g.recipientCategory,
        form: g.form,
        lifetimeTaxPaidPence: g.lifetimeTaxPaidPence ?? null,
        smallGift: Boolean(g.smallGift),
        weddingGift: g.weddingGift ?? null,
        normalExpenditure: Boolean(g.normalExpenditure),
        reliefKind: g.relief?.kind ?? null,
        reliefRate: g.relief?.rate ?? null,
        reliefStillQualifies: g.relief?.stillQualifiesAtDeath ?? true,
        voidedAt: g.voided ? new Date() : null,
      };
      if (isNew) await tx.insert(schema.lifetimeGift).values({ ...base, key: g.id, ...gv });
      else await tx.update(schema.lifetimeGift).set(gv).where(where(schema.lifetimeGift, g.id));
    }
    for (const { item: p, isNew } of changed(before?.tax?.priorTransfers, t.priorTransfers)) {
      const v = {
        label: p.label,
        transferOn: p.transferOn,
        netIncreasePence: p.netIncreasePence,
        grossTransferPence: p.grossTransferPence,
        taxPaidPence: p.taxPaidPence,
        voidedAt: p.voided ? new Date() : null,
      };
      if (isNew) await tx.insert(schema.priorTransfer).values({ ...base, key: p.id, ...v });
      else await tx.update(schema.priorTransfer).set(v).where(where(schema.priorTransfer, p.id));
    }
  }

  // Estate-level fields.
  const estateChanged =
    !before ||
    !same(
      [before.deceased, before.funeralEstimatePence, before.todayStep, before.feeEarnerId, before.serviceLevel],
      [after.deceased, after.funeralEstimatePence, after.todayStep, after.feeEarnerId, after.serviceLevel],
    );
  await tx
    .update(schema.estate)
    .set({
      ...(estateChanged
        ? {
            deceasedFullName: after.deceased.fullName,
            deceasedFirstName: after.deceased.firstName,
            deceasedShortName: after.deceased.shortName,
            deceasedAliases: after.deceased.aliases ?? [],
            dateOfBirth: after.deceased.dateOfBirth ?? null,
            dateOfDeath: after.deceased.dateOfDeath,
            placeOfDeath: after.deceased.placeOfDeath ?? null,
            maritalStatus: after.deceased.maritalStatus ?? null,
            funeralEstimatePence: after.funeralEstimatePence,
            todayStep: after.todayStep ?? null,
            serviceLevel: after.serviceLevel,
            feeEarnerId: after.feeEarnerId || null,
          }
        : {}),
      version: sql`${schema.estate.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(schema.estate.id, ctx.estateUuid));
}
