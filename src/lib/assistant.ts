import type { DemoState, Estate } from "./types";
import { clientParty, estateSummary, feeEarner, firstName, openFamilyTasks } from "./selectors";
import { ihtFor, unconfirmedFlags } from "./iht";
import { fullDay, money } from "./format";

/**
 * Assistant seam.
 *
 * In this prototype answers are rule-based so the demo works offline. The shape
 * (`{ paragraphs, handoff }`) is what a real model-backed endpoint should return.
 * Rules that must survive the swap:
 *  - The client assistant gives general guidance only, never advice about the
 *    specific estate, and always offers a handoff to the solicitor.
 *  - Anything the firm assistant produces is a draft for a solicitor to review.
 */

export interface AssistantReply {
  paragraphs: string[];
  handoff: boolean;
}

const GLOSSARY: { match: RegExp; answer: (fn: string, sol: string) => string[]; handoff?: boolean }[] = [
  {
    match: /iht\s?400/i,
    answer: (_fn, sol) => [
      "It's the main form that tells HMRC about an estate when Inheritance Tax might be due. It lists what the person owned and owed.",
      `${sol} fills it in. She may ask you for a few details along the way.`,
    ],
  },
  {
    match: /grant of probate|what is probate|probate\b/i,
    answer: (fn) => [
      `A grant of probate is a legal document from the court. It confirms the executor is allowed to deal with ${fn}'s money and property.`,
      "Banks and other organisations usually ask to see it before they release funds. The probate office currently takes about 8 to 16 weeks.",
    ],
  },
  {
    match: /sell (the )?house|sell (the )?home|property/i,
    answer: () => [
      "In general, a house that belonged only to the person who died can't be sold until the grant of probate has been issued. You can often put it on the market before then, but the sale can't complete.",
      "Whether that applies here depends on how the house was owned, so it's one to check.",
    ],
    handoff: true,
  },
  {
    match: /executor/i,
    answer: () => [
      "An executor is the person named in the will to sort out the estate: gathering what the person owned, paying any debts and tax, then passing on what's left.",
      "Your solicitor does most of the work, but the executor makes the final decisions and signs the key forms.",
    ],
  },
  {
    match: /beneficiar/i,
    answer: () => ["A beneficiary is someone who receives something from the estate, under the will or under the rules that apply when there's no will."],
  },
  {
    match: /frozen|freeze/i,
    answer: () => [
      "When a bank learns someone has died it pauses their accounts. That's normal and protects the money.",
      "Most banks will still pay a funeral invoice directly from the account if you send it to them or your solicitor.",
    ],
  },
  {
    match: /gazette|notice/i,
    answer: () => [
      "A Gazette notice is a short advert in the official public record. It gives anyone the person owed money a set time to come forward.",
      "It's a routine step that protects the executor from unexpected claims later.",
    ],
  },
  {
    match: /nil.?rate|rnrb|nrb|inheritance tax|\biht\b/i,
    answer: () => [
      "Inheritance Tax is only due if an estate is worth more than certain allowances. Everyone has a £325,000 nil-rate band, and there's up to £175,000 more when a home passes to children or grandchildren.",
      "Your solicitor works out whether any tax is due and handles the forms.",
    ],
  },
  {
    match: /how long|timeline|when will/i,
    answer: () => [
      "Most estates take between 9 and 12 months, sometimes longer if HMRC have questions or banks are slow to reply.",
      "Your journey screen shows where things are and what's expected next.",
    ],
    handoff: true,
  },
];

export function clientAnswer(question: string, state: DemoState, estate: Estate): AssistantReply {
  const fn = estate.deceased.firstName;
  const sol = firstName(feeEarner(state, estate).name);
  for (const g of GLOSSARY) {
    if (g.match.test(question)) return { paragraphs: g.answer(fn, sol), handoff: !!g.handoff };
  }
  return {
    paragraphs: [
      `That sounds like a question about ${fn}'s estate specifically, so ${sol} is the right person to answer it.`,
      "I can explain general terms and steps. Try asking what a word means, or what usually happens next.",
    ],
    handoff: true,
  };
}

export const CLIENT_SUGGESTIONS = ["What is a grant of probate?", "Can I sell the house yet?", "What does frozen mean?"];

export function firmAnswer(question: string, state: DemoState, estate: Estate): string[] {
  const q = question.toLowerCase();
  const client = clientParty(estate);
  if (/iht|tax|nil|rnrb|nrb/.test(q)) {
    const view = ihtFor(estate);
    const r = view.result;
    if (!r) return ["IHT isn't calculated yet.", ...view.gaps.filter((g) => g.blocking).map((g) => g.message)];
    const open = unconfirmedFlags(view, estate.tax).length;
    return [
      `Chargeable estate ${money(r.estate.chargeablePence)} against available bands of ${money(r.estate.nilRateBandAvailablePence + r.estate.residenceNilRateBandPence)}.`,
      r.totalTaxPence > 0 ? `IHT ${money(r.totalTaxPence)} on the current figures, due by ${fullDay(r.paymentDueOn)}.` : "No IHT on the current figures.",
      open ? `${open} point${open > 1 ? "s" : ""} in the IHT tab still need a solicitor to confirm.` : "",
      view.gaps.length ? "Some figures are missing; see the IHT tab before relying on this." : "",
    ].filter(Boolean);
  }
  if (/sarah|family|client|executor|waiting on/.test(q)) {
    const fam = openFamilyTasks(estate);
    return fam.length
      ? [`${fam.length} item${fam.length > 1 ? "s" : ""} with ${client.name}: ${fam.map((t) => t.title.toLowerCase()).join("; ")}.`]
      : [`Nothing is currently waiting on ${client.name}.`];
  }
  return estateSummary(state, estate).map((s) => (s.label ? `${s.label}: ${s.text}` : s.text));
}
