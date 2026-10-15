/**
 * Waymark rules engine: IHT and intestacy for England & Wales.
 * Pure TypeScript, no I/O. Rates are data in `tables.ts`, selected by date of death.
 */
export { calculateIht, grossUp } from "./calculate";
export { distributeIntestacy, intestacyAsDispositions } from "./intestacy";
export { assessLifetimeGifts, isWithinSevenYears } from "./gifts";
export { computeRnrb } from "./rnrb";
export { deathEstateReliefs } from "./reliefs";
export { quickSuccessionRelief } from "./qsr";
export { reportingRoute, schedulesFor } from "./reporting";
export { rulesFor, statutoryLegacy, SOURCES } from "./tables";
export * from "./util";
export type * from "./types";
