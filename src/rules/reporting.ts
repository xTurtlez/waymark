import { SOURCES } from "./tables";
import type { EstateAsset, ExceptedLimits, Flag, ISODate, Pence, ReportingRoute } from "./types";
import { formatPounds } from "./util";

export interface ReportingInput {
  dateOfDeath: ISODate;
  limits: ExceptedLimits;
  nilRateBandPence: Pence;
  transferredNrbBp: number;
  longTermUkResident: boolean;
  /** Gross estate including joint shares, before liabilities (the excepted-estate "gross value"). */
  grossPence: Pence;
  netPence: Pence;
  spouseExemptPence: Pence;
  charityExemptPence: Pence;
  specifiedTransfersPence: Pence;
  specifiedExemptTransfersPence: Pence;
  foreignPence: Pence;
  hasSettledProperty: boolean;
  hasGiftWithReservation: boolean;
  trustGiftWithinSevenYears: boolean;
  pensionsInEstate: boolean;
  hasEstatePension: boolean;
  taxPence: Pence;
}

export interface ReportingOutcome {
  route: ReportingRoute;
  reasons: string[];
  flags: Flag[];
}

/**
 * Whether the estate is "excepted" (no IHT400 needed). Deaths from
 * 1 January 2022 report excepted estates through the probate application;
 * IHT205 was withdrawn for those deaths. Earlier deaths used IHT205.
 */
export function reportingRoute(i: ReportingInput): ReportingOutcome {
  const reasons: string[] = [];
  const flags: Flag[] = [];
  const L = i.limits;

  // Conditions every excepted route shares.
  const blockers: string[] = [];
  if (!i.longTermUkResident) blockers.push("the deceased was not a long-term UK resident (or UK-domiciled)");
  if (i.foreignPence > L.foreignLimitPence) blockers.push(`foreign assets of ${formatPounds(i.foreignPence)} are over ${formatPounds(L.foreignLimitPence)}`);
  if (i.specifiedTransfersPence > L.specifiedTransfersLimitPence) blockers.push(`gifts in the 7 years before death of ${formatPounds(i.specifiedTransfersPence)} are over ${formatPounds(L.specifiedTransfersLimitPence)}`);
  if (i.hasSettledProperty) blockers.push("there is trust (settled) property");
  if (i.hasGiftWithReservation) blockers.push("there is a gift with reservation of benefit");
  if (i.trustGiftWithinSevenYears) blockers.push("a gift into trust was made in the 7 years before death");
  if (i.taxPence > 0) blockers.push("tax is payable");

  const withTransfers = i.grossPence + i.specifiedTransfersPence + i.specifiedExemptTransfersPence;
  const fullTnrb = i.transferredNrbBp >= 10_000;
  const lowThreshold = fullTnrb ? i.nilRateBandPence * 2 : i.nilRateBandPence;
  const lowValue = withTransfers <= lowThreshold;
  const netChargeable = i.netPence - i.spouseExemptPence - i.charityExemptPence + i.specifiedTransfersPence;
  const exempt = withTransfers <= L.exemptGrossLimitPence && netChargeable <= i.nilRateBandPence && i.spouseExemptPence + i.charityExemptPence > 0;

  if (blockers.length) {
    reasons.push(`Not an excepted estate because ${blockers.join("; ")}.`);
  } else if (lowValue) {
    reasons.push(`Gross estate with gifts of ${formatPounds(withTransfers)} is within ${formatPounds(lowThreshold)}${fullTnrb ? " (double nil-rate band with a full transfer)" : ""}.`);
    if (fullTnrb) {
      flags.push({
        code: "excepted_tnrb",
        level: "confirm",
        message: "Excepted using a full transferred nil-rate band. Confirm the conditions for the predeceased spouse's estate are met.",
        source: SOURCES.exceptedLowValue,
      });
    }
  } else if (exempt) {
    reasons.push(
      `Gross estate of ${formatPounds(withTransfers)} is within ${formatPounds(L.exemptGrossLimitPence)} and, after spouse and charity exemptions, ${formatPounds(netChargeable)} is within the nil-rate band.`,
    );
  } else {
    reasons.push(
      `Gross estate with gifts of ${formatPounds(withTransfers)} is over ${formatPounds(lowThreshold)}` +
        (withTransfers <= L.exemptGrossLimitPence ? `, and ${formatPounds(netChargeable)} after spouse and charity exemptions is over the nil-rate band.` : "."),
    );
  }

  const excepted = !blockers.length && (lowValue || exempt);
  if (excepted && i.pensionsInEstate && i.hasEstatePension) {
    flags.push({
      code: "excepted_pensions",
      level: "confirm",
      message: "Unused pension funds count in the estate from 6 April 2027. Confirm the excepted estate regulations for pensions before relying on this.",
      source: SOURCES.pensions,
    });
  }
  if (excepted && L.regime === "pre_2022") {
    flags.push({ code: "excepted_pre_2022", level: "confirm", message: "Deaths before 1 January 2022 used form IHT205 with earlier limits. Confirm the limits for this date of death.", source: SOURCES.exceptedExempt });
  }

  const route: ReportingRoute = !excepted ? "iht400" : L.regime === "pre_2022" ? "iht205" : lowValue ? "excepted_low_value" : "excepted_exempt";
  return { route, reasons, flags };
}

const SCHEDULES: Record<string, string> = {
  IHT402: "Claim to transfer unused nil rate band",
  IHT403: "Gifts and other transfers of value",
  IHT404: "Jointly owned assets",
  IHT405: "Houses, land, buildings and interests in land",
  IHT406: "Bank and building society accounts and National Savings & Investments",
  IHT407: "Household and personal goods",
  IHT409: "Pensions",
  IHT410: "Life assurance and annuities",
  IHT411: "Listed stocks and shares",
  IHT412: "Unlisted stocks and shares, and control holdings",
  IHT413: "Business and partnership interests and assets",
  IHT414: "Agricultural relief",
  IHT416: "Debts due to the estate",
  IHT417: "Foreign assets",
  IHT418: "Assets held in trust",
  IHT419: "Debts owed by the deceased",
  IHT430: "Reduced rate of Inheritance Tax",
  IHT435: "Claim to the residence nil rate band",
  IHT436: "Claim to transfer unused residence nil rate band",
};

export function schedulesFor(i: {
  assets: EstateAsset[];
  hasDebts: boolean;
  hasGifts: boolean;
  transferredNrb: boolean;
  transferredRnrb: boolean;
  claimsRnrb: boolean;
  charityRate: boolean;
}): { form: string; title: string }[] {
  const forms = new Set<string>();
  if (i.transferredNrb) forms.add("IHT402");
  if (i.hasGifts) forms.add("IHT403");
  for (const a of i.assets) {
    if (a.ownership === "joint_tenancy" || a.ownership === "tenancy_in_common") forms.add("IHT404");
    if (a.kind === "property") forms.add("IHT405");
    if (a.kind === "bank" || a.kind === "savings" || a.kind === "bonds") forms.add("IHT406");
    if (a.kind === "chattels") forms.add("IHT407");
    if (a.kind === "pension" || a.pension) forms.add("IHT409");
    if (a.kind === "life_policy") forms.add("IHT410");
    if (a.kind === "listed_shares") forms.add("IHT411");
    if (a.kind === "unlisted_shares") forms.add("IHT412");
    if (a.kind === "business" || a.relief?.kind === "business") forms.add("IHT413");
    if (a.kind === "agricultural" || a.relief?.kind === "agricultural") forms.add("IHT414");
    if (a.kind === "debt_due") forms.add("IHT416");
    if (a.foreign) forms.add("IHT417");
    if (a.settled) forms.add("IHT418");
  }
  if (i.hasDebts) forms.add("IHT419");
  if (i.charityRate) forms.add("IHT430");
  if (i.claimsRnrb) forms.add("IHT435");
  if (i.transferredRnrb) forms.add("IHT436");
  return [...forms].sort().map((form) => ({ form, title: SCHEDULES[form] }));
}
