import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { db } from "@/lib/db";
import { spreadsheetData, spaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import logger from "@/lib/logger";
import { fortuneSheetsToWorkbookData } from "@/lib/spreadsheet/fortune-to-univer";

type Params = { params: Promise<{ sheetId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { sheetId } = await params;

  try {
    const [row] = await db
      .select({ data: spreadsheetData.data })
      .from(spreadsheetData)
      .where(eq(spreadsheetData.sheetId, sheetId))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Tableur introuvable" }, { status: 404 });
    }

    const parsed = JSON.parse(row.data);
    const data = Array.isArray(parsed)
      ? fortuneSheetsToWorkbookData(parsed)
      : parsed;
    return NextResponse.json({ data });
  } catch (error) {
    logger.error({ err: error }, "[spreadsheet] GET error");
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { sheetId } = await params;
  const body = await req.json();
  const { data, spaceId } = body;

  if (!data || (typeof data !== "object" && !Array.isArray(data))) {
    return NextResponse.json({ error: "data invalide" }, { status: 400 });
  }

  try {
    // Si c'est encore du Fortune Sheet (tableau), convertir avant stockage
    const toStore = Array.isArray(data) ? fortuneSheetsToWorkbookData(data) : data;
    const serialized = JSON.stringify(toStore);

    // Vérifier que l'espace existe si fourni
    if (spaceId) {
      const [space] = await db
        .select({ id: spaces.id })
        .from(spaces)
        .where(eq(spaces.id, spaceId))
        .limit(1);
      if (!space) {
        return NextResponse.json({ error: "Espace introuvable" }, { status: 404 });
      }
    }

    await db
      .insert(spreadsheetData)
      .values({
        sheetId,
        spaceId: spaceId ?? null,
        data: serialized,
      })
      .onConflictDoUpdate({
        target: spreadsheetData.sheetId,
        set: {
          data: serialized,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error({ err: error }, "[spreadsheet] PUT error");
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
