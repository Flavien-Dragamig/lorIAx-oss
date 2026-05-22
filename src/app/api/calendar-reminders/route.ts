import { NextResponse } from "next/server";
import { processReminders } from "@/lib/calendar/notifications";

/**
 * POST /api/calendar-reminders
 * Process pending calendar reminders (called by cron every minute).
 * Protected by a shared secret to prevent unauthorized access.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // In production, require a secret to prevent abuse
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sent = await processReminders();

  return NextResponse.json({
    processed: sent,
    timestamp: new Date().toISOString(),
  });
}
