import { sendViaProvider, getFromAddress } from "./provider";
import logger from "@/lib/logger";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface SendEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send an email via the configured provider (SMTP or Resend).
 * Returns { success: false } silently if email is not configured.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    const from = await getFromAddress();

    return await sendViaProvider({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    logger.error("[email] Erreur d'envoi: %s", message);
    return { success: false, error: message };
  }
}
