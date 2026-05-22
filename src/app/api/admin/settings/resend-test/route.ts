import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { getEmailConfig, verifyResend } from "@/lib/email/provider";
import { Resend } from "resend";
import logger from "@/lib/logger";

export async function POST() {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const config = await getEmailConfig();

    if (!config.emailEnabled || !config.resendApiKey) {
      return NextResponse.json(
        { error: "Resend non configuré. Activez l'envoi d'emails et renseignez la clé API." },
        { status: 400 }
      );
    }

    // Verify API key
    await verifyResend(config);

    // Send test email
    const resend = new Resend(config.resendApiKey);
    const from = config.resendFrom || `LorIAx <noreply@loriax.local>`;

    const { error } = await resend.emails.send({
      from,
      to: user.email,
      subject: "LorIAx — Test Resend",
      text: "La connexion Resend fonctionne correctement.",
      html: `<p>La connexion Resend fonctionne correctement.</p><p style="color:#888;font-size:12px;">Email de test envoyé depuis l'administration LorIAx.</p>`,
    });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      message: `Email de test envoyé à ${user.email}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    logger.error("[resend-test] Erreur: %s", message);
    return NextResponse.json(
      { error: `Échec Resend : ${message}` },
      { status: 500 }
    );
  }
}
