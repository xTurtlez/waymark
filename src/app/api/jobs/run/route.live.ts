import { NextResponse } from "next/server";
import "@/server/jobs/handlers";
import { runDueJobs } from "@/server/jobs/queue";

/**
 * Job runner, called by Vercel Cron (see vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorised", { status: 401 });
  const results = await runDueJobs({ limit: 25 });
  return NextResponse.json({ ran: results.length, results });
}
