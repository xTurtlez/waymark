import { deriveState } from "./derive";
import { addDays, fullDay, isoDay } from "./format";
import type { DemoState, Estate, Party, StageIndex, Task, TaxProfile, ThirdPartyCategory } from "./types";

/** An empty tax profile with some fields filled in. */
function taxProfile(p: Partial<TaxProfile> = {}): TaxProfile {
  return {
    longTermUkResident: true,
    spouseExemptionLimited: false,
    transferredNrbBp: 0,
    transferredRnrbBp: 0,
    residueBenham: false,
    mergeCharityComponents: false,
    confirmations: {},
    gifts: [],
    priorTransfers: [],
    ...p,
  };
}

/**
 * Demo data. Sample estate from the design handoff: Margaret Ellis; her
 * daughter Sarah is executor; solicitor Priya Shah at Ellis & Rowe.
 *
 * Every date is relative to `now`, so the demo reads the same whenever it is
 * opened: Barclays is always 21 days late, the house valuation is always in
 * five days, and Sarah's statement always arrived yesterday evening.
 */

export const SEED_VERSION = 5;

type Raw = Omit<Estate, "stage" | "daysOpen" | "waitingOn" | "blocker" | "attention">;

function clock(now: Date) {
  const today = isoDay(now);
  return {
    today,
    /** Calendar day `n` days from today (negative = past). */
    day: (n: number) => addDays(today, n),
    /** A moment `n` days from now at a UK-ish clock time. */
    at: (n: number, hhmm = "09:00") => {
      const d = addDays(today, n);
      // Interpret as UK local time; BST/GMT difference is cosmetic for seed data.
      return new Date(`${d}T${hhmm}:00Z`).toISOString();
    },
  };
}

function ellis(now: Date): Raw {
  const c = clock(now);
  const dod = c.day(-149);
  return {
    id: "ellis",
    ref: "HRT-0412",
    deceased: {
      firstName: "Margaret",
      fullName: "Margaret Ann Ellis",
      shortName: "Margaret Ellis",
      dateOfBirth: addDays(dod, -Math.round(81.4 * 365.25)),
      dateOfDeath: dod,
      placeOfDeath: "Bath",
      maritalStatus: "widowed",
    },
    serviceLevel: "full_admin",
    openedAt: c.at(-96, "10:30"),
    milestones: { registered: c.day(-130), gathered: c.day(-84) },
    will: {
      dated: "2019-03-12",
      originalHeld: true,
      location: "Firm safe",
      codicils: 0,
      gifts: [
        { id: "g1", kind: "specific", beneficiaryPartyId: "p_sarah", description: "12 Elm Road, Bath", assetId: "a_house" },
        { id: "g2", kind: "residuary", beneficiaryPartyId: "p_sarah", description: "Residue, half", shareBp: 5000 },
        { id: "g3", kind: "residuary", beneficiaryPartyId: "p_tom", description: "Residue, half", shareBp: 5000, substitution: "to his children if he dies first" },
      ],
    },
    feeEarnerId: "s_ps",
    clientPartyId: "p_sarah",
    funeralEstimatePence: 420_000,
    parties: [
      { id: "p_sarah", name: "Sarah Ellis", initials: "SE", role: "executor", relationship: "daughter", email: "sarah.ellis@example.com", color: "#E3A13A", portalStatus: "active" },
      { id: "p_tom", name: "Tom Ellis", initials: "TE", role: "beneficiary", relationship: "son", detail: "Canada", email: "tom.ellis@example.com", color: "#5B2E57", portalStatus: "invited" },
      { id: "p_priya", name: "Priya Shah", initials: "PS", role: "solicitor", detail: "fee earner", color: "#E36E55", staffId: "s_ps" },
      { id: "p_james", name: "James Tan", initials: "JT", role: "paralegal", color: "#0E5F5B", staffId: "s_jt" },
    ],
    tasks: [
      { id: "t_barclays", title: "Chase Barclays for date-of-death balance", owner: { kind: "third", label: "Barclays", category: "bank" }, dueOn: c.day(-7), done: false, createdAt: c.at(-21, "11:00") },
      { id: "t_aviva", title: "Notify Aviva of death, request pension details", owner: { kind: "firm", staffId: "s_ps" }, dueOn: c.today, done: false, createdAt: c.at(-3) },
      { id: "t_check_nationwide", title: "Check Nationwide statement from Sarah", owner: { kind: "firm", staffId: "s_ps" }, dueOn: c.today, done: false, createdAt: c.at(-1, "21:05") },
      { id: "t_aviva_letter", title: "Find Aviva pension letter", owner: { kind: "family", partyId: "p_sarah" }, dueOn: c.day(6), done: false, createdAt: c.at(-10) },
      { id: "t_funeral", title: "Funeral invoice for direct payment", owner: { kind: "family", partyId: "p_sarah" }, dueOn: c.day(6), done: false, createdAt: c.at(-10) },
      { id: "t_valuation", title: "Instruct estate agent valuation", owner: { kind: "firm", staffId: "s_jt" }, dueOn: c.day(-4), done: true, doneAt: c.at(-4, "11:15"), createdAt: c.at(-12) },
    ],
    assets: [
      { id: "a_house", kind: "property", name: "12 Elm Road, Bath", institution: "Freehold", state: "estimate", valuePence: 36_500_000, liability: false, addedBy: "firm", nextAction: "valuation", nextActionOn: c.day(5), tax: { qualifyingResidence: true } },
      { id: "a_barclays", kind: "bank", name: "Current account", clientName: "Barclays current account", institution: "Barclays", reference: "ending 2291", state: "awaiting", valuePence: 824_000, liability: false, addedBy: "family" },
      { id: "a_nationwide", kind: "savings", name: "Savings", clientName: "Nationwide savings", institution: "Nationwide", reference: "ending 4417", state: "estimate", valuePence: 2_156_000, liability: false, addedBy: "family" },
      { id: "a_bonds", kind: "bonds", name: "Premium Bonds", institution: "NS&I", state: "confirmed", valuePence: 1_750_000, liability: false, addedBy: "firm" },
      { id: "a_pension", kind: "pension", name: "Pension", clientName: "Aviva pension", institution: "Aviva", state: "not_notified", valuePence: null, liability: false, addedBy: "firm", tax: { pension: "unused_fund" } },
      { id: "a_card", kind: "credit", name: "Credit card", clientName: "Barclaycard", institution: "Barclaycard", state: "confirmed", valuePence: 363_600, liability: true, addedBy: "family" },
      { id: "a_energy", kind: "utility", name: "Final energy bill", clientName: "British Gas final bill", institution: "British Gas", state: "confirmed", valuePence: 21_400, liability: true, addedBy: "family" },
    ],
    documents: [
      { id: "d_death", name: "Death certificate", icon: "certificate", state: "accepted", copies: 3, uploadedBy: "p_sarah", uploadedAt: c.at(-130, "14:20") },
      { id: "d_will", name: "The will", icon: "scroll", state: "held", uploadedBy: "p_priya", uploadedAt: c.at(-127, "10:00") },
      { id: "d_barclays", name: "Barclays letter", icon: "bank", state: "accepted", uploadedBy: "p_sarah", uploadedAt: c.at(-4, "19:40") },
      { id: "d_council", name: "Council tax bill", icon: "house", state: "accepted", uploadedBy: "p_sarah", uploadedAt: c.at(-82, "20:10") },
      { id: "d_nationwide", name: "Nationwide statement", icon: "file", state: "checking", uploadedBy: "p_sarah", uploadedAt: c.at(-1, "21:05"), fileName: "Nationwide statement.jpg" },
      { id: "d_aviva", name: "Aviva pension letter", hint: "Look for a policy number", icon: "envelope", state: "needed" },
      { id: "d_funeral", name: "Funeral invoice", hint: "So the bank can pay it", icon: "receipt", state: "needed" },
    ],
    audit: [
      { id: "au1", at: c.at(0, "07:02"), actor: "ai", text: "Assistant drafted chaser to Barclays. Awaiting review." },
      { id: "au2", at: c.at(-1, "21:05"), actor: "p_sarah", text: "Sarah uploaded Nationwide statement.jpg" },
      { id: "au3", at: c.at(-1, "16:40"), actor: "s_ps", text: "Priya marked Barclays letter as checked" },
      { id: "au4", at: c.at(-4, "11:15"), actor: "s_jt", text: `James booked valuation, 12 Elm Road, ${fullDay(c.day(5))}` },
      { id: "au5", at: c.at(-8, "09:30"), actor: "s_ps", text: "Gazette notice published (s.27 Trustee Act)" },
    ],
    notes: [{ id: "n1", text: "Sarah prefers evening calls after 7pm. Brother Tom lives in Canada; send copies by email.", author: "s_ps", at: c.at(-8, "12:00") }],
    drafts: [
      {
        id: "dr_barclays",
        kind: "letter",
        title: "Chaser to Barclays",
        to: "Barclays Bereavement Services",
        re: "Mrs M A Ellis, a/c ending 2291",
        body: [
          "Dear Sir or Madam,",
          `We act for the executor of the late Mrs Margaret Ann Ellis. We wrote on ${fullDay(c.day(-21)).replace(/ \d{4}$/, "")} requesting the balance and accrued interest as at [[${fullDay(dod)}]], and have not yet received a reply.`,
          "Please could you provide this within 14 days. A certified copy of the death certificate is enclosed.",
        ],
        signOff: "Yours faithfully,\nEllis & Rowe Solicitors",
        sources: "death certificate · Barclays letter · sent log. Highlighted date pulled from certificate.",
        status: "review",
        createdAt: c.at(0, "07:02"),
        taskId: "t_barclays",
        clientUpdate: { title: "We've written to Barclays on your behalf", body: "Asking for the balance on the day Margaret died. They usually reply in 2 to 3 weeks." },
      },
    ],
    extractions: [
      {
        id: "x_nationwide",
        documentId: "d_nationwide",
        fileName: "Nationwide statement.jpg",
        assetId: "a_nationwide",
        status: "review",
        fields: [
          { key: "Account holder", value: "Mrs Margaret A Ellis", confidence: "high" },
          { key: "Sort code", value: "07-04-36", confidence: "high" },
          { key: "Account number", value: "•••• 4417", confidence: "high" },
          { key: `Balance at ${fullDay(dod)}`, value: "£21,560.14", confidence: "check", note: "Check: low light" },
          { key: "Account type", value: "FlexDirect savings", confidence: "medium" },
        ],
      },
    ],
    missing: [
      { id: "m_aviva", title: "Aviva pension not notified", body: "Policy mentioned in Barclays statement (monthly credit). No letter on file.", action: "Draft notification letter", actionKind: "draft-aviva", tone: "coral" },
      { id: "m_rnrb", title: "RNRB evidence", body: "Will leaves home to Sarah. Add property title to support the claim.", action: "Request from Land Registry", actionKind: "request", tone: "amber" },
      { id: "m_funeral", title: "Funeral invoice", body: "Needed for direct payment from Barclays.", action: "Remind Sarah", actionKind: "remind-family", tone: "amber" },
      { id: "m_tom_id", title: "Tom Ellis ID", body: "Beneficiary ID not yet verified.", action: "Send ID request", actionKind: "id-check", tone: "plum" },
    ],
    messages: [
      { id: "msg1", from: "firm", authorId: "s_ps", sentAt: c.at(-4, "10:12"), text: "Hi Sarah, Barclays have confirmed Margaret's account is frozen. That's normal. I've asked them for the balance on the day she died.", attachment: "Barclays letter.pdf" },
      { id: "msg2", from: "client", authorId: "p_sarah", sentAt: c.at(-4, "21:38"), text: "Thank you. Does frozen mean the funeral bill can't be paid?" },
      { id: "msg3", from: "firm", authorId: "s_ps", sentAt: c.at(-3, "09:05"), text: "Good question. Most banks will pay a funeral invoice straight from a frozen account. Send me the invoice and I'll arrange it." },
    ],
    updates: [
      { id: "u1", at: c.at(-1, "16:45"), title: "Your Barclays letter has been checked", body: "Thank you, Sarah. Nothing more needed from you on this one.", tone: "amber" },
      { id: "u2", at: c.at(-4, "11:20"), title: `House valuation booked for ${fullDay(c.day(5)).replace(/ \d{4}$/, "")}`, body: "A local agent will visit 12 Elm Road. You don't need to be there.", tone: "amber" },
      { id: "u3", at: c.at(-8, "09:40"), title: "A notice has been placed in The Gazette", body: "This gives anyone Margaret owed money a chance to come forward. It's a normal step, and it protects you as executor.", tone: "amber" },
      { id: "u4", at: c.at(-84, "15:00"), title: "Stage 2 complete: documents gathered", body: "A big step. Everything Priya needed to begin valuing the estate.", tone: "teal", milestone: true },
    ],
    // Margaret's husband Robert died in 2015 leaving everything to her, so both his allowances transfer.
    tax: taxProfile({ transferredNrbBp: 10_000, transferredRnrbBp: 10_000, predeceasedSpouse: { name: "Robert Ellis", diedOn: "2015-08-03" } }),
    todayStep: {
      title: "Let's list what Margaret owned",
      stepTitle: "Let's list Margaret's bank accounts",
      body: "Start with her bank accounts. A recent statement for each is enough. Priya will do the rest.",
      why: "Banks pause accounts when someone dies. Before anything can be shared out, Priya needs to know each account so she can ask for the exact balance.",
      needs: ["The name of each bank or building society", "A statement or letter, if you have one. A photo is fine.", "Roughly how much was in it. A guess is fine."],
      minutes: 15,
    },
  };
}

/** Milestones reached for an estate at a given stage, spread over the time it has been open. */
function milestonesFor(stage: StageIndex, openedDaysAgo: number, c: ReturnType<typeof clock>): Raw["milestones"] {
  const keys = ["registered", "gathered", "valued", "iht", "grant", "collected", "distributed"] as const;
  const out: Raw["milestones"] = {};
  for (let i = 0; i < stage; i++) out[keys[i]] = c.day(-Math.round(openedDaysAgo * (1 - (i + 1) / (stage + 1))));
  return out;
}

/** A lighter estate record for the rest of the caseload. */
function lite(
  now: Date,
  o: {
    id: string;
    ref: string;
    name: string;
    client: string;
    stage: StageIndex;
    days: number;
    third?: { label: string; category: ThirdPartyCategory; title: string; ageDays: number; dueInDays: number | null };
    familyItems: { title: string; ageDays: number }[];
    firmTasks: string[];
    earner: string;
    relationship?: string;
  },
): Raw {
  const c = clock(now);
  const [first] = o.name.split(" ");
  const [cFirst, ...cRest] = o.client.split(" ");
  const clientId = `p_${o.id}_client`;
  const client: Party = {
    id: clientId,
    name: o.client,
    initials: (cFirst[0] + (cRest.at(-1)?.[0] ?? "")).toUpperCase(),
    role: "executor",
    relationship: o.relationship ?? "family",
    color: "#E3A13A",
    portalStatus: "active",
  };
  const tasks: Task[] = [
    ...o.firmTasks.map((title, i) => ({ id: `${o.id}_ft${i}`, title, owner: { kind: "firm" as const, staffId: o.earner }, dueOn: i === 0 ? c.today : c.day(7), done: false, createdAt: c.at(-2) })),
    ...o.familyItems.map((f, i) => ({ id: `${o.id}_fam${i}`, title: f.title, owner: { kind: "family" as const, partyId: clientId }, dueOn: c.day(6), done: false, createdAt: c.at(-f.ageDays) })),
  ];
  if (o.third) {
    tasks.unshift({
      id: `${o.id}_third`,
      title: o.third.title,
      owner: { kind: "third", label: o.third.label, category: o.third.category },
      dueOn: o.third.dueInDays === null ? null : c.day(o.third.dueInDays),
      done: false,
      createdAt: c.at(-o.third.ageDays),
    });
  }
  return {
    id: o.id,
    ref: o.ref,
    deceased: { firstName: first, fullName: o.name, shortName: o.name, dateOfDeath: c.day(-o.days - 30) },
    serviceLevel: "full_admin",
    openedAt: c.at(-o.days, "10:00"),
    milestones: milestonesFor(o.stage, o.days, c),
    feeEarnerId: o.earner,
    clientPartyId: clientId,
    funeralEstimatePence: 0,
    parties: [client],
    tasks,
    assets: [],
    documents: [],
    audit: [],
    notes: [],
    drafts: [],
    extractions: [],
    missing: [],
    messages: [],
    updates: [],
    tax: taxProfile(),
  };
}

export function buildSeed(now: Date = new Date()): DemoState {
  const c = clock(now);

  const asante = lite(now, {
    id: "asante", ref: "HRT-0377", name: "Kwame Asante", client: "Ama Asante", stage: 2, days: 71, earner: "s_jt", relationship: "wife",
    third: { label: "Aviva", category: "bank", title: "Aviva pension details", ageDays: 33, dueInDays: -5 },
    familyItems: [], firmTasks: ["Chase Aviva for pension details"],
  });
  asante.drafts.push({
    id: "dr_asante_aviva",
    kind: "letter",
    title: "Pension claim to Aviva",
    to: "Aviva Bereavement Team",
    re: "Mr K Asante, policy ending 8810",
    body: [
      "Dear Sir or Madam,",
      `We act for the executor of the late Mr Kwame Asante. We wrote on ${fullDay(c.day(-33)).replace(/ \d{4}$/, "")} notifying you of his death and requesting details of any lump sum and dependant's pension, and have not yet received a reply.`,
      "Please could you confirm the position within 14 days.",
    ],
    signOff: "Yours faithfully,\nEllis & Rowe Solicitors",
    sources: "death certificate · sent log.",
    status: "review",
    createdAt: c.at(0, "06:58"),
    taskId: "asante_ft0",
    clientUpdate: { title: "We've chased Aviva about the pension", body: "Asking again for details of Kwame's pension. We'll tell you as soon as they reply." },
  });
  asante.parties.push({ id: "p_asante_jt", name: "James Tan", initials: "JT", role: "paralegal", color: "#0E5F5B", staffId: "s_jt" });

  const mehta = lite(now, {
    id: "mehta", ref: "HRT-0389", name: "Anil Mehta", client: "Ravi Mehta", stage: 3, days: 140, earner: "s_ps", relationship: "son",
    third: { label: "HMRC", category: "hmrc", title: "HMRC query on IHT400", ageDays: 18, dueInDays: 12 },
    familyItems: [{ title: "Confirm gifts made in last 7 years", ageDays: 6 }], firmTasks: ["Reply to HMRC IHT400 query"],
  });
  mehta.drafts.push({
    id: "dr_mehta_hmrc",
    kind: "letter",
    title: "IHT400 query reply",
    to: "HMRC Inheritance Tax",
    re: "Estate of Anil Mehta, IHT ref ending 5521",
    body: [
      "Dear Sir or Madam,",
      `Thank you for your letter of [[${fullDay(c.day(-18))}]] regarding the IHT400 submitted for the above estate.`,
      "We enclose the requested valuation of the shareholding as at the date of death, together with the broker's confirmation. We trust this resolves your query.",
    ],
    signOff: "Yours faithfully,\nEllis & Rowe Solicitors",
    sources: "HMRC letter · broker valuation.",
    status: "review",
    createdAt: c.at(0, "06:40"),
    taskId: "mehta_ft0",
    clientUpdate: { title: "We've replied to HMRC", body: "We've answered HMRC's question about the shares. They usually respond within a few weeks." },
  });

  // Asante: the half share of the home passes to Ama by survivorship; the will leaves her everything.
  asante.deceased.maritalStatus = "married";
  asante.assets = [
    { id: "as_house", kind: "property", name: "7 Larch Way, Frome (half share)", institution: "Joint with Ama", state: "estimate", valuePence: 21_000_000, liability: false, addedBy: "firm", tax: { ownership: "joint_tenancy", survivorPartyId: "p_asante_client", qualifyingResidence: true } },
    { id: "as_savings", kind: "savings", name: "Savings", clientName: "Coventry BS savings", institution: "Coventry Building Society", state: "confirmed", valuePence: 6_000_000, liability: false, addedBy: "family" },
    { id: "as_pension", kind: "pension", name: "Pension", clientName: "Aviva pension", institution: "Aviva", state: "awaiting", valuePence: 18_000_000, liability: false, addedBy: "firm", tax: { pension: "unused_fund", pensionRecipientPartyId: "p_asante_client" } },
  ];
  asante.will = { dated: "2012-05-20", originalHeld: false, location: "Barclays safe custody", codicils: 0, gifts: [{ id: "ag1", kind: "residuary", beneficiaryPartyId: "p_asante_client", description: "Everything to Ama", shareBp: 10_000 }] };

  // Mehta: a taxable estate. Widower (Asha's allowances transfer), a gift to Ravi within 7 years, and a charity legacy.
  const mehtaDod = mehta.deceased.dateOfDeath!;
  mehta.deceased.maritalStatus = "widowed";
  mehta.parties.push({ id: "p_mehta_hospice", name: "St Peter's Hospice", initials: "SP", role: "beneficiary", color: "#5B2E57", taxCategory: "charity" });
  mehta.funeralEstimatePence = 600_000;
  mehta.assets = [
    { id: "m_house", kind: "property", name: "14 Orchard Close, Bath", institution: "Freehold", state: "confirmed", valuePence: 65_000_000, liability: false, addedBy: "firm", tax: { qualifyingResidence: true } },
    { id: "m_shares", kind: "investment", name: "Share portfolio", institution: "Hargreaves Lansdown", state: "confirmed", valuePence: 90_000_000, liability: false, addedBy: "firm" },
    { id: "m_cash", kind: "bank", name: "Current account", institution: "Lloyds", state: "confirmed", valuePence: 15_000_000, liability: false, addedBy: "firm" },
  ];
  mehta.will = {
    dated: "2018-11-02",
    originalHeld: true,
    location: "Firm safe",
    codicils: 1,
    gifts: [
      { id: "mg1", kind: "specific", beneficiaryPartyId: "p_mehta_client", description: "14 Orchard Close, Bath", assetId: "m_house" },
      { id: "mg2", kind: "pecuniary", beneficiaryPartyId: "p_mehta_hospice", description: "£25,000 to St Peter's Hospice", amountPence: 2_500_000 },
      { id: "mg3", kind: "residuary", beneficiaryPartyId: "p_mehta_client", description: "Residue to Ravi", shareBp: 10_000 },
    ],
  };
  mehta.tax = taxProfile({
    transferredNrbBp: 10_000,
    transferredRnrbBp: 10_000,
    predeceasedSpouse: { name: "Asha Mehta", diedOn: "2019-02-11" },
    gifts: [
      { id: "lg_mehta_1", madeOn: addDays(mehtaDod, -900), valuePence: 10_000_000, description: "Gift to Ravi towards a house deposit", recipientPartyId: "p_mehta_client", recipientCategory: "lineal_descendant", form: "outright" },
    ],
  });

  // Reid: no will found yet, so the intestacy rules apply. Moira and two children survive.
  const reid = lite(now, { id: "reid", ref: "HRT-0430", name: "Thomas Reid", client: "Moira Reid", stage: 0, days: 8, earner: "s_ps", relationship: "wife",
    familyItems: [{ title: "Add family details", ageDays: 8 }, { title: "Upload death certificate", ageDays: 8 }, { title: "Tell us where the will is", ageDays: 8 }, { title: "List bank accounts", ageDays: 8 }], firmTasks: ["Welcome call with Moira"] });
  reid.deceased.maritalStatus = "married";
  reid.assets = [
    { id: "r_house", kind: "property", name: "3 Mill Lane, Bradford-on-Avon", institution: "Freehold", state: "estimate", valuePence: 38_000_000, liability: false, addedBy: "firm", tax: { qualifyingResidence: true } },
    { id: "r_savings", kind: "savings", name: "Savings", clientName: "Halifax savings", institution: "Halifax", state: "estimate", valuePence: 9_500_000, liability: false, addedBy: "family" },
    { id: "r_goods", kind: "other", name: "Household and personal goods", institution: "", state: "estimate", valuePence: 1_200_000, liability: false, addedBy: "family" },
  ];
  reid.tax = taxProfile({
    intestacyFamily: {
      spouseName: "Moira Reid",
      issue: [{ name: "Fiona Reid", alive: true }, { name: "Callum Reid", alive: true }],
      parents: [],
      siblingsWhole: [],
      siblingsHalf: [],
      grandparents: [],
      auntsUnclesWhole: [],
      auntsUnclesHalf: [],
    },
  });

  const raw: Raw[] = [
    ellis(now),
    asante,
    mehta,
    lite(now, { id: "whitfield", ref: "HRT-0421", name: "Jean Whitfield", client: "David Whitfield", stage: 1, days: 34, earner: "s_lm", relationship: "son",
      familyItems: [{ title: "Find the original will", ageDays: 32 }, { title: "Death certificate copies", ageDays: 20 }, { title: "Bank statements", ageDays: 20 }], firmTasks: [] }),
    lite(now, { id: "okafor", ref: "HRT-0398", name: "Harold Okafor", client: "Grace Okafor", stage: 4, days: 182, earner: "s_jt", relationship: "daughter",
      third: { label: "Probate Registry", category: "registry", title: "Grant application", ageDays: 42, dueInDays: null }, familyItems: [], firmTasks: ["Check Registry status"] }),
    lite(now, { id: "pike", ref: "HRT-0365", name: "Rosemary Pike", client: "Neil Pike", stage: 4, days: 155, earner: "s_lm", relationship: "son",
      third: { label: "Probate Registry", category: "registry", title: "Grant application", ageDays: 21, dueInDays: null }, familyItems: [{ title: "Sign statement of truth", ageDays: 3 }], firmTasks: [] }),
    reid,
    lite(now, { id: "lowe", ref: "HRT-0341", name: "Brenda Lowe", client: "Paul Lowe", stage: 5, days: 260, earner: "s_jt", relationship: "son",
      third: { label: "Nationwide", category: "bank", title: "Closing accounts", ageDays: 9, dueInDays: 12 }, familyItems: [], firmTasks: ["Confirm Nationwide closure funds"] }),
    lite(now, { id: "morgan", ref: "HRT-0322", name: "Eileen Morgan", client: "Carys Morgan", stage: 6, days: 301, earner: "s_ps", relationship: "daughter",
      familyItems: [], firmTasks: ["Share final estate accounts"] }),
  ];

  return deriveState(
    {
      version: SEED_VERSION,
      firm: { id: "f_er", name: "Ellis & Rowe Solicitors", shortName: "Ellis & Rowe", town: "Bath" },
      staff: [
        { id: "s_ps", name: "Priya Shah", initials: "PS", role: "Partner", color: "#E36E55" },
        { id: "s_jt", name: "James Tan", initials: "JT", role: "Paralegal", color: "#0E5F5B" },
        { id: "s_lm", name: "Laura Mills", initials: "LM", role: "Associate", color: "#5B2E57" },
      ],
      currentStaffId: "s_ps",
      currentClientEstateId: "ellis",
      onboarded: true,
      estates: raw as Estate[],
    },
    now,
  );
}

/** A fresh copy of the demo data, dated relative to now. */
export function freshSeed(): DemoState {
  return buildSeed(new Date());
}
