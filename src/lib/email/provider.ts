import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

export type EmailProvider = "smtp" | "resend";

export interface EmailConfig {
  emailEnabled?: boolean;
  emailProvider?: EmailProvider;
  // SMTP
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFrom?: string;
  smtpSecure?: boolean;
  // Resend
  resendApiKey?: string;
  resendFrom?: string;
}

export interface SendViaProviderParams {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendViaProviderResult {
  success: boolean;
  error?: string;
}

/**
 * Déchiffre un champ s'il est au format chiffré (iv:tag:cipher).
 */
function decryptField(value: string | undefined): string | undefined {
  if (!value) return value;
  if (/^[0-9a-f]{32}:[0-9a-f]{32}:/.test(value)) {
    try {
      return decrypt(value);
    } catch {
      return value;
    }
  }
  return value;
}

// ─── Cache SMTP ─────────────────────────────────────────────────────────────

let cachedTransporter: Transporter | null = null;
let cachedConfigHash: string | null = null;

// ─── Config ─────────────────────────────────────────────────────────────────

/**
 * Load email configuration from system settings.
 * Supports both legacy "smtp" key and new "email" key.
 */
export async function getEmailConfig(): Promise<EmailConfig> {
  const rows = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "email"))
    .limit(1);

  if (rows.length > 0) {
    const config = (rows[0].value as EmailConfig) ?? {};
    // Déchiffrer les champs sensibles
    config.smtpPassword = decryptField(config.smtpPassword);
    config.resendApiKey = decryptField(config.resendApiKey);
    return config;
  }

  // Fallback: legacy "smtp" key → map to new format
  const legacyRows = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "smtp"))
    .limit(1);

  if (legacyRows.length > 0) {
    const legacy = legacyRows[0].value as Record<string, unknown>;
    return {
      emailEnabled: legacy.smtpEnabled as boolean | undefined,
      emailProvider: "smtp",
      smtpHost: legacy.smtpHost as string | undefined,
      smtpPort: legacy.smtpPort as number | undefined,
      smtpUser: legacy.smtpUser as string | undefined,
      smtpPassword: decryptField(legacy.smtpPassword as string | undefined),
      smtpFrom: legacy.smtpFrom as string | undefined,
      smtpSecure: legacy.smtpSecure as boolean | undefined,
    };
  }

  return {};
}

// ─── SMTP ───────────────────────────────────────────────────────────────────

function getSmtpTransporter(config: EmailConfig): Transporter | null {
  if (!config.smtpHost) return null;

  const configHash = JSON.stringify({
    host: config.smtpHost,
    port: config.smtpPort,
    user: config.smtpUser,
    pass: config.smtpPassword,
    secure: config.smtpSecure,
  });

  if (cachedTransporter && cachedConfigHash === configHash) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort || 587,
    secure: config.smtpSecure ?? false,
    auth:
      config.smtpUser && config.smtpPassword
        ? { user: config.smtpUser, pass: config.smtpPassword }
        : undefined,
  });

  cachedConfigHash = configHash;
  return cachedTransporter;
}

async function sendViaSmtp(
  config: EmailConfig,
  params: SendViaProviderParams
): Promise<SendViaProviderResult> {
  const transporter = getSmtpTransporter(config);
  if (!transporter) {
    return { success: false, error: "SMTP non configuré" };
  }

  await transporter.sendMail({
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  return { success: true };
}

/**
 * Verify SMTP connection. Throws on failure.
 */
export async function verifySmtp(config: EmailConfig): Promise<void> {
  const transporter = getSmtpTransporter(config);
  if (!transporter) {
    throw new Error("SMTP non configuré");
  }
  await transporter.verify();
}

// ─── Resend ─────────────────────────────────────────────────────────────────

async function sendViaResend(
  config: EmailConfig,
  params: SendViaProviderParams
): Promise<SendViaProviderResult> {
  if (!config.resendApiKey) {
    return { success: false, error: "Clé API Resend non configurée" };
  }

  const resend = new Resend(config.resendApiKey);

  const { error } = await resend.emails.send({
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Verify Resend API key by sending a minimal request.
 */
export async function verifyResend(config: EmailConfig): Promise<void> {
  if (!config.resendApiKey) {
    throw new Error("Clé API Resend non configurée");
  }

  // Validate the API key by fetching domains (lightweight check)
  const resend = new Resend(config.resendApiKey);
  const { error } = await resend.domains.list();

  if (error) {
    throw new Error(error.message);
  }
}

// ─── Dispatch ───────────────────────────────────────────────────────────────

/**
 * Send an email via the configured provider (SMTP or Resend).
 */
export async function sendViaProvider(
  params: SendViaProviderParams
): Promise<SendViaProviderResult> {
  const config = await getEmailConfig();

  if (!config.emailEnabled) {
    return { success: false, error: "Envoi d'emails désactivé" };
  }

  const provider = config.emailProvider ?? "smtp";

  if (provider === "resend") {
    return sendViaResend(config, params);
  }

  return sendViaSmtp(config, params);
}

/**
 * Get the configured "from" address.
 */
export async function getFromAddress(): Promise<string> {
  const config = await getEmailConfig();
  const provider = config.emailProvider ?? "smtp";

  if (provider === "resend") {
    return config.resendFrom || `LorIAx <noreply@loriax.local>`;
  }

  return config.smtpFrom || `LorIAx <noreply@loriax.local>`;
}

/**
 * Invalidate the cached SMTP transporter (call after config changes).
 */
export function invalidateTransporter() {
  cachedTransporter = null;
  cachedConfigHash = null;
}
