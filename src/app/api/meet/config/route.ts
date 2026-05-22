import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { getLiveKitConfig } from "@/lib/meet/livekit-config";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  const config = await getLiveKitConfig();

  return NextResponse.json({
    enabled: config.livekitEnabled,
    url: config.livekitUrl,
  });
}
