import { NextResponse } from "next/server";
import { purgeAllData } from "@/lib/setup/purge";
import { guardSetupNotCompleted } from "@/lib/setup/guards";

export async function POST() {
  const blocked = await guardSetupNotCompleted();
  if (blocked) return blocked;

  try {
    await purgeAllData();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[setup/purge] Erreur lors de la purge :", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression des données" },
      { status: 500 }
    );
  }
}
