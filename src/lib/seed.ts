import type { DemoState, Estate, Party, StageIndex, Task, WaitingOn } from "./types";

/**
 * Demo data. Sample estate from the design handoff: Margaret Ellis, died May 2026;
 * her daughter Sarah is executor; solicitor Priya Shah at Ellis & Rowe.
 */

export const SEED_VERSION = 3;

const ellis: Estate = {
  id: "ellis",
  ref: "HRT-0412",
  deceased: {
    firstName: "Margaret",
    fullName: "Margaret Ann Ellis",
    shortName: "Margaret Ellis",
    dateOfDeath: "2026-05-14",
    placeOfDeath: "Bath",
    willDated: "2019",
  },
  stage: 2,
  daysOpen: 96,
  feeEarnerId: "s_ps",
  clientPartyId: "p_sarah",
  waitingOn: "bank",
  blocker: "Waiting on Barclays for a valuation · 21 days",
  attention: true,
  typicalDuration: "9 to 12 months",
  monthsIn: 3,
  funeralEstimatePence: 420_000,
  parties: [
    { id: "p_sarah", name: "Sarah Ellis", initials: "SE", role: "executor", relationship: "daughter", email: "sarah.ellis@example.com", color: "#E3A13A", portalStatus: "active" },
    { id: "p_tom", name: "Tom Ellis", initials: "TE", role: "beneficiary", relationship: "son", detail: "Canada", email: "tom.ellis@example.com", color: "#5B2E57", portalStatus: "invited" },
    { id: "p_priya", name: "Priya Shah", initials: "PS", role: "solicitor", detail: "fee earner", color: "#E36E55", staffId: "s_ps" },
    { id: "p_james", name: "James Tan", initials: "JT", role: "paralegal", color: "#0E5F5B", staffId: "s_jt" },
  ],
  tasks: [
    { id: "t_barclays", title: "Chase Barclays for date-of-death balance", owner: { kind: "third", label: "Barclays" }, due: "Overdue", overdue: true, done: false },
    { id: "t_aviva", title: "Notify Aviva of death, request pension details", owner: { kind: "firm", staffId: "s_ps" }, due: "Today", done: false },
    { id: "t_check_nationwide", title: "Check Nationwide statement from Sarah", owner: { kind: "firm", staffId: "s_ps" }, due: "Today", done: false },
    { id: "t_aviva_letter", title: "Find Aviva pension letter", owner: { kind: "family", partyId: "p_sarah" }, due: "Fri", done: false },
    { id: "t_funeral", title: "Funeral invoice for direct payment", owner: { kind: "family", partyId: "p_sarah" }, due: "Fri", done: false },
    { id: "t_valuation", title: "Instruct estate agent valuation", owner: { kind: "firm", staffId: "s_jt" }, due: "6 Oct", done: true, doneOn: "6 Oct" },
  ],
  assets: [
    { id: "a_house", kind: "property", name: "12 Elm Road, Bath", institution: "Freehold", state: "estimate", firmStatus: "Valuation 15 Oct", clientStatus: "Valuation on 15 Oct", valuePence: 36_500_000, liability: false, addedBy: "firm" },
    { id: "a_barclays", kind: "bank", name: "Current account", clientName: "Barclays current account", institution: "Barclays", state: "awaiting", firmStatus: "Awaiting", clientStatus: "Waiting on Barclays", valuePence: 824_000, liability: false, addedBy: "family" },
    { id: "a_nationwide", kind: "savings", name: "Savings", clientName: "Nationwide savings", institution: "Nationwide", state: "estimate", firmStatus: "To check", clientStatus: "Priya is checking", valuePence: 2_156_000, liability: false, addedBy: "family" },
    { id: "a_bonds", kind: "bonds", name: "Premium Bonds", institution: "NS&I", state: "confirmed", firmStatus: "Confirmed", clientStatus: "Confirmed", valuePence: 1_750_000, liability: false, addedBy: "firm" },
    { id: "a_pension", kind: "pension", name: "Pension", clientName: "Aviva pension", institution: "Aviva", state: "not_notified", firmStatus: "Not notified", clientStatus: "Priya will contact Aviva", valuePence: null, liability: false, addedBy: "firm" },
    { id: "a_card", kind: "credit", name: "Credit card", clientName: "Barclaycard", institution: "Barclaycard", state: "confirmed", firmStatus: "Confirmed", clientStatus: "Bill paused", valuePence: 363_600, liability: true, addedBy: "family" },
    { id: "a_energy", kind: "utility", name: "Final energy bill", clientName: "British Gas final bill", institution: "British Gas", state: "confirmed", firmStatus: "Confirmed", clientStatus: "To pay later", valuePence: 21_400, liability: true, addedBy: "family" },
  ],
  documents: [
    { id: "d_death", name: "Death certificate", icon: "certificate", state: "accepted", copies: 3, uploadedBy: "p_sarah", uploadedAt: "2 June" },
    { id: "d_will", name: "The will", icon: "scroll", state: "held", uploadedBy: "p_priya", uploadedAt: "5 June" },
    { id: "d_barclays", name: "Barclays letter", icon: "bank", state: "accepted", uploadedBy: "p_sarah", uploadedAt: "6 Oct" },
    { id: "d_council", name: "Council tax bill", icon: "house", state: "accepted", uploadedBy: "p_sarah", uploadedAt: "20 July" },
    { id: "d_nationwide", name: "Nationwide statement", icon: "file", state: "checking", uploadedBy: "p_sarah", uploadedAt: "Yesterday 21:05", fileName: "Nationwide statement.jpg" },
    { id: "d_aviva", name: "Aviva pension letter", hint: "Look for a policy number", icon: "envelope", state: "needed" },
    { id: "d_funeral", name: "Funeral invoice", hint: "So the bank can pay it", icon: "receipt", state: "needed" },
  ],
  audit: [
    { id: "au1", at: "10 Oct 07:02", actor: "ai", text: "Assistant drafted chaser to Barclays. Awaiting review." },
    { id: "au2", at: "09 Oct 21:05", actor: "p_sarah", text: "Sarah uploaded Nationwide statement.jpg" },
    { id: "au3", at: "09 Oct 16:40", actor: "s_ps", text: "Priya marked Barclays letter as checked" },
    { id: "au4", at: "06 Oct 11:15", actor: "s_jt", text: "James booked valuation, 12 Elm Road, 15 Oct" },
    { id: "au5", at: "02 Oct 09:30", actor: "s_ps", text: "Gazette notice published (s.27 Trustee Act)" },
  ],
  notes: [
    { id: "n1", text: "Sarah prefers evening calls after 7pm. Brother Tom lives in Canada; send copies by email.", author: "s_ps", at: "2 Oct" },
  ],
  drafts: [
    {
      id: "dr_barclays",
      kind: "letter",
      title: "Chaser to Barclays",
      to: "Barclays Bereavement Services",
      re: "Mrs M A Ellis, a/c ending 2291",
      body: [
        "Dear Sir or Madam,",
        "We act for the executor of the late Mrs Margaret Ann Ellis. We wrote on 19 September requesting the balance and accrued interest as at [[14 May 2026]], and have not yet received a reply.",
        "Please could you provide this within 14 days. A certified copy of the death certificate is enclosed.",
      ],
      signOff: "Yours faithfully,\nEllis & Rowe Solicitors",
      sources: "death certificate · Barclays letter 6 Oct · sent log 19 Sep. Highlighted date pulled from certificate.",
      status: "review",
      createdAt: "10 Oct 07:02",
      taskId: "t_barclays",
      clientUpdate: {
        title: "We've written to Barclays on your behalf",
        body: "Asking for the balance on the day Margaret died. They usually reply in 2 to 3 weeks.",
      },
    },
  ],
  extractions: [
    {
      id: "x_nationwide",
      documentId: "d_nationwide",
      fileName: "Nationwide statement.jpg",
      from: "Photo from Sarah · yesterday 21:05",
      assetId: "a_nationwide",
      status: "review",
      fields: [
        { key: "Account holder", value: "Mrs Margaret A Ellis", confidence: "high" },
        { key: "Sort code", value: "07-04-36", confidence: "high" },
        { key: "Account number", value: "•••• 4417", confidence: "high" },
        { key: "Balance at 14 May 2026", value: "£21,560.14", confidence: "check", note: "Check: low light" },
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
    { id: "msg1", from: "firm", authorId: "s_ps", day: "Tuesday", at: "10:12", text: "Hi Sarah, Barclays have confirmed Margaret's account is frozen. That's normal. I've asked them for the balance on the day she died.", attachment: "Barclays letter.pdf" },
    { id: "msg2", from: "client", authorId: "p_sarah", day: "Tuesday", at: "21:38", text: "Thank you. Does frozen mean the funeral bill can't be paid?" },
    { id: "msg3", from: "firm", authorId: "s_ps", day: "Wednesday", at: "09:05", text: "Good question. Most banks will pay a funeral invoice straight from a frozen account. Send me the invoice and I'll arrange it." },
  ],
  updates: [
    { id: "u1", when: "Yesterday", title: "Your Barclays letter has been checked", body: "Thank you, Sarah. Nothing more needed from you on this one.", tone: "amber" },
    { id: "u2", when: "6 October", title: "House valuation booked for 15 October", body: "A local agent will visit 12 Elm Road. You don't need to be there.", tone: "amber" },
    { id: "u3", when: "2 October", title: "A notice has been placed in The Gazette", body: "This gives anyone Margaret owed money a chance to come forward. It's a normal step, and it protects you as executor.", tone: "amber" },
    { id: "u4", when: "18 July", title: "Stage 2 complete: documents gathered", body: "A big step. Everything Priya needed to begin valuing the estate.", tone: "teal", milestone: true },
  ],
  todayStep: {
    title: "Let's list what Margaret owned",
    stepTitle: "Let's list Margaret's bank accounts",
    body: "Start with her bank accounts. A recent statement for each is enough. Priya will do the rest.",
    why: "Banks pause accounts when someone dies. Before anything can be shared out, Priya needs to know each account so she can ask for the exact balance.",
    needs: [
      "The name of each bank or building society",
      "A statement or letter, if you have one. A photo is fine.",
      "Roughly how much was in it. A guess is fine.",
    ],
    minutes: 15,
  },
};

/** A lighter estate record for the rest of the caseload. */
function lite(o: {
  id: string;
  ref: string;
  name: string;
  client: string;
  stage: StageIndex;
  days: number;
  waitingOn: WaitingOn;
  blocker: string;
  familyItems: string[];
  firmTasks: string[];
  attention: boolean;
  earner: string;
  relationship?: string;
}): Estate {
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
    ...o.firmTasks.map((title, i) => ({ id: `${o.id}_ft${i}`, title, owner: { kind: "firm" as const, staffId: o.earner }, due: i === 0 ? "Today" : "Next week", done: false })),
    ...o.familyItems.map((title, i) => ({ id: `${o.id}_fam${i}`, title, owner: { kind: "family" as const, partyId: clientId }, due: "Fri", done: false })),
  ];
  return {
    id: o.id,
    ref: o.ref,
    deceased: { firstName: first, fullName: o.name, shortName: o.name, dateOfDeath: "2026-01-01" },
    stage: o.stage,
    daysOpen: o.days,
    feeEarnerId: o.earner,
    clientPartyId: clientId,
    waitingOn: o.waitingOn,
    blocker: o.blocker,
    attention: o.attention,
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
  };
}

const asante = lite({ id: "asante", ref: "HRT-0377", name: "Kwame Asante", client: "Ama Asante", stage: 2, days: 71, waitingOn: "bank", blocker: "Waiting on Aviva pension details · 33 days, overdue", familyItems: [], firmTasks: ["Chase Aviva for pension details"], attention: true, earner: "s_jt", relationship: "wife" });
asante.drafts.push({
  id: "dr_asante_aviva",
  kind: "letter",
  title: "Pension claim to Aviva",
  to: "Aviva Bereavement Team",
  re: "Mr K Asante, policy ending 8810",
  body: [
    "Dear Sir or Madam,",
    "We act for the executor of the late Mr Kwame Asante. We wrote on 28 August notifying you of his death and requesting details of any lump sum and dependant's pension, and have not yet received a reply.",
    "Please could you confirm the position within 14 days.",
  ],
  signOff: "Yours faithfully,\nEllis & Rowe Solicitors",
  sources: "death certificate · sent log 28 Aug.",
  status: "review",
  createdAt: "10 Oct 06:58",
  taskId: "asante_ft0",
  clientUpdate: { title: "We've chased Aviva about the pension", body: "Asking again for details of Kwame's pension. We'll tell you as soon as they reply." },
});
asante.parties.push({ id: "p_asante_jt", name: "James Tan", initials: "JT", role: "paralegal", color: "#0E5F5B", staffId: "s_jt" });

const mehta = lite({ id: "mehta", ref: "HRT-0389", name: "Anil Mehta", client: "Ravi Mehta", stage: 3, days: 140, waitingOn: "hmrc", blocker: "HMRC query on IHT400 · reply due in 12 days", familyItems: ["Confirm gifts made in last 7 years"], firmTasks: ["Reply to HMRC IHT400 query"], attention: true, earner: "s_ps", relationship: "son" });
mehta.drafts.push({
  id: "dr_mehta_hmrc",
  kind: "letter",
  title: "IHT400 query reply",
  to: "HMRC Inheritance Tax",
  re: "Estate of Anil Mehta, IHT ref ending 5521",
  body: [
    "Dear Sir or Madam,",
    "Thank you for your letter of [[22 September 2026]] regarding the IHT400 submitted for the above estate.",
    "We enclose the requested valuation of the shareholding as at the date of death, together with the broker's confirmation. We trust this resolves your query.",
  ],
  signOff: "Yours faithfully,\nEllis & Rowe Solicitors",
  sources: "HMRC letter 22 Sep · broker valuation 30 Sep.",
  status: "review",
  createdAt: "10 Oct 06:40",
  taskId: "mehta_ft0",
  clientUpdate: { title: "We've replied to HMRC", body: "We've answered HMRC's question about the shares. They usually respond within a few weeks." },
});

export const SEED: DemoState = {
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
  estates: [
    ellis,
    asante,
    mehta,
    lite({ id: "whitfield", ref: "HRT-0421", name: "Jean Whitfield", client: "David Whitfield", stage: 1, days: 34, waitingOn: "family", blocker: "Waiting on David for the original will", familyItems: ["Find the original will", "Death certificate copies", "Bank statements"], firmTasks: [], attention: true, earner: "s_lm", relationship: "son" }),
    lite({ id: "okafor", ref: "HRT-0398", name: "Harold Okafor", client: "Grace Okafor", stage: 4, days: 182, waitingOn: "registry", blocker: "Probate Registry · applied 6 weeks ago", familyItems: [], firmTasks: ["Check Registry status"], attention: false, earner: "s_jt", relationship: "daughter" }),
    lite({ id: "pike", ref: "HRT-0365", name: "Rosemary Pike", client: "Neil Pike", stage: 4, days: 155, waitingOn: "registry", blocker: "Probate Registry · applied 3 weeks ago", familyItems: ["Sign statement of truth"], firmTasks: [], attention: false, earner: "s_lm", relationship: "son" }),
    lite({ id: "reid", ref: "HRT-0430", name: "Thomas Reid", client: "Moira Reid", stage: 0, days: 8, waitingOn: "family", blocker: "Onboarding · Moira is adding family details", familyItems: ["Add family details", "Upload death certificate", "Tell us where the will is", "List bank accounts"], firmTasks: ["Welcome call with Moira"], attention: false, earner: "s_ps", relationship: "wife" }),
    lite({ id: "lowe", ref: "HRT-0341", name: "Brenda Lowe", client: "Paul Lowe", stage: 5, days: 260, waitingOn: "bank", blocker: "Nationwide closing accounts · 9 days", familyItems: [], firmTasks: ["Confirm Nationwide closure funds"], attention: false, earner: "s_jt", relationship: "son" }),
    lite({ id: "morgan", ref: "HRT-0322", name: "Eileen Morgan", client: "Carys Morgan", stage: 6, days: 301, waitingOn: "none", blocker: "On track · final estate accounts ready to share", familyItems: [], firmTasks: ["Share final estate accounts"], attention: false, earner: "s_ps", relationship: "daughter" }),
  ],
};

/** A deep copy so reducers never mutate the seed. */
export function freshSeed(): DemoState {
  return JSON.parse(JSON.stringify(SEED)) as DemoState;
}
