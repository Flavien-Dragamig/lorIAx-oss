import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema-org";
import { eq } from "drizzle-orm";
import { isValidSlug, isReservedSlug } from "@/lib/billing/slug-validation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug")?.toLowerCase().trim() ?? "";

  if (!isValidSlug(slug)) {
    return NextResponse.json(
      { available: false, reason: "Format invalide (3-32 caractères, minuscules et tirets uniquement)" },
      { status: 400 }
    );
  }

  if (isReservedSlug(slug)) {
    return NextResponse.json({ available: false, reason: "Ce nom est réservé" });
  }

  const [existing] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  return NextResponse.json({ available: !existing });
}
