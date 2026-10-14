import postgres from "postgres";

/** Owner connection for assertions about what the app wrote (audit rows, chain). */
export function adminSql() {
  const url = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_ADMIN_URL for E2E assertions.");
  return postgres(url, { max: 1, onnotice: () => {} });
}
