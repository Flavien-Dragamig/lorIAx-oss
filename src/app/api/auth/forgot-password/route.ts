import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { sendEmail } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates/password-reset";
import { checkRateLimit, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";
import logger from "@/lib/logger";

const schema = z.object({
  email: z.string().email("Email invalide"),
});

const RESET_TOKEN_EXPIRY_MINUTES = 60;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimitResult = checkRateLimit(`forgot-password:${ip}`, RATE_LIMITS.auth);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase().trim();

    // SEC-10 — Rate limit par email (3 tentatives par 15 min)
    const emailRateLimit = checkRateLimit(
      `forgot-password:email:${email}`,
      { maxRequests: 3, windowMs: 15 * 60 * 1000 }
    );
    if (!emailRateLimit.success) {
      // Retourner le même message de succès pour ne pas révéler l'existence de l'email
      return NextResponse.json({
        message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.",
      });
    }

    // Always return 200 to not reveal if email exists
    const successResponse = NextResponse.json({
      message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.",
    });

    const [user] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return successResponse;
    }

    // Generate secure token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    });

    // Build reset URL
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    const template = passwordResetEmail({
      userName: user.name,
      resetUrl,
      expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
    });

    await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    return successResponse;
  } catch (error) {
    logger.error({ err: error }, "[forgot-password] Erreur demande de réinitialisation");
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
