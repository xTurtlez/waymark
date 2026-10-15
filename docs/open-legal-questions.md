# Open legal and tax questions

Rules the engine (`src/rules/`) encodes that a solicitor should confirm. Each says what we assumed, why, and where it shows up. When the engine meets one of these on a live estate it raises a **confirm** flag in the IHT tab, which a solicitor must tick. Items marked *not calculated* raise an **out of scope** flag and the result is marked incomplete.

Checked against sources on 15 October 2026. Sources are linked in `src/rules/tables.ts`.

## Rates and thresholds

1. **Thresholds after 5 April 2030.** HMRC's manual (IHTM46002) fixes the NRB (£325k), RNRB (£175k) and taper threshold (£2m) to 5 April 2030. Autumn Budget 2025 announced the freeze would run to April 2031. *Assumed:* the same figures apply; deaths after 5 April 2030 get a `rates_unconfirmed` flag until the extension is confirmed in legislation.
2. **Business and agricultural relief allowance from 6 April 2026.** £2.5m of 100% relief (raised from £1m on 23 December 2025; Finance Act 2026 s.65, Sch 12), 50% above it, and 50% for "not listed" shares such as AIM. *Assumed:* (a) only property that would otherwise get 100% relief uses the allowance; (b) the allowance is shared across assets in proportion to value; (c) gifts made from 30 October 2024 use the allowance first, in date order, then the death estate; (d) gifts before 30 October 2024 keep the old uncapped relief and don't use the allowance; (e) a spouse's unused allowance is entered as a figure (the full £2.5m if they died before 6 April 2026); (f) CPI indexation from 2031 isn't applied, because it needs a future statutory instrument.

## Residence nil-rate band

3. **"Other assets closely inherited" for the downsizing addition** are measured after business and agricultural relief, and exclude pensions. HMRC's guidance doesn't say how relieved property counts here.
4. **Percentages in the downsizing calculation** are worked to 0.01% (rounded half up). The GOV.UK examples use whole percentages, so their results match exactly.
5. **A home in residue on intestacy** (spouse and issue) counts as closely inherited in proportion to the issue's share of residue (50%).
6. **Pensions and the £2m taper.** For deaths from 6 April 2027 the engine includes unused pension funds in the estate value compared with the taper threshold. The HMRC technical note doesn't address this (`pension_apportionment` flag).

## Charity and the 36% rate

7. **The RNRB is not deducted when working out the baseline amount.** This follows practitioners' reading of HMRC's manual (IHTM45009). We couldn't read that page directly when building the engine.
8. **The nil-rate band is apportioned between components** (will, joint property, gifts with reservation, pensions) in proportion to their chargeable value, both for the baseline and when components pay different rates (`charity_components` flag).
9. **Pensions from 6 April 2027 are a separate component** for the 36% test. Not confirmed by HMRC guidance.

## Lifetime gifts

10. **Transferred nil-rate band and failed gifts.** A predeceased spouse's transferred NRB is added to the band available for gifts made in the 7 years before death, as well as for the estate.
11. **Gifts on the same day** take the annual exemption in the order they were entered. Strictly, it is shared between them in proportion.
12. **29 February anniversaries.** The anniversary of 29 February in a non-leap year is taken as 1 March, so a 7-year period never ends early. This only matters for a gift made on 29 February.
13. **Normal expenditure out of income** is exempt only when a solicitor confirms the conditions (`normal_expenditure` flag).
14. **Relief on lifetime gifts** depends on whether the property still qualifies at death; the solicitor records that (`gift_relief_lost` flag when it doesn't).

## Spouse exemption

15. **Non-resident spouse cap.** When the deceased was a long-term UK resident (UK-domiciled before 6 April 2025) and the spouse is not, the exemption is capped at the nil-rate band at death, less earlier capped gifts. *Not modelled:* the spouse's election to be treated as UK resident, and the lower caps that applied to gifts before 6 April 2013 (`spouse_cap` flag).

## Pensions (deaths from 6 April 2027)

16. **Tax on pensions is apportioned at the estate rate** (by value) between the free estate and each pension. Death-in-service benefits and dependants' scheme pensions are excluded. Pensions before 6 April 2027 are left out, with a flag to check for non-discretionary benefits.
17. **Excepted estates with pensions.** We haven't seen updated excepted-estate regulations for pensions; an excepted result with pensions is flagged (`excepted_pensions`).

## Excepted estates

18. **Full transferred NRB doubles the low-value limit.** Assumed for a 100% transfer; the conditions on the predeceased spouse's estate aren't checked (`excepted_tnrb` flag).
19. **Deaths before 1 January 2022** used IHT205 with an exempt-estate limit of £1m and £150k limits for gifts and trusts (`excepted_pre_2022` flag).

## Estate administration

20. **Debts larger than the free estate** are not set against joint or other property (`liabilities_exceed_free_estate` flag). The engine takes the cautious view (more tax).
21. **Interest on the intestacy statutory legacy** is ignored for IHT, following HMRC IHTM12122.

## Not calculated yet

- Trust (settled) property and interests in possession (`settled:*`).
- People who were not long-term UK residents (`non_resident`).
- Residue divided so beneficiaries receive equal amounts after tax: Re Benham (`benham`); the usual (Ratcliffe) basis is shown.
- Partial intestacy where residue shares don't add up to 100% (`residue_shares`): the undisposed part is treated as chargeable.
- Deaths before 6 April 2017 (`death_before_2017`) and intestacy before 1 October 2014.
- Double tax relief on foreign assets, and instalment interest.
