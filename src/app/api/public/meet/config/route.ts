import { NextResponse } from "next/server";

/**
 * GET /api/public/meet/config
 * Returns LiveKit server URL for guest WebRTC connection.
 * No authentication required.
 */
export async function GET(): Promise<NextResponse> {
  const liveKitUrl = process.env.LIVEKIT_URL || "ws://localhost:7880";

  return NextResponse.json({ url: liveKitUrl }, { status: 200 });
}
