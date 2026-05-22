import { wrapInLayout } from "./base-layout";

interface PasswordResetTemplateParams {
  userName: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export function passwordResetEmail(params: PasswordResetTemplateParams) {
  const html = wrapInLayout(`
    <h2 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#18181b;">
      Réinitialisation de mot de passe
    </h2>
    <p style="margin:0 0 16px;font-size:14px;color:#3f3f46;line-height:1.6;">
      Bonjour ${params.userName},
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#3f3f46;line-height:1.6;">
      Vous avez demandé la réinitialisation de votre mot de passe.
      Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
      <tr>
        <td style="background-color:#18181b;border-radius:8px;padding:12px 24px;">
          <a href="${params.resetUrl}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">
            Réinitialiser mon mot de passe
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px;font-size:13px;color:#71717a;line-height:1.5;">
      Ce lien expire dans ${params.expiresInMinutes} minutes.
    </p>
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
      Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
    </p>
  `);

  const text = `Bonjour ${params.userName},

Vous avez demandé la réinitialisation de votre mot de passe.
Cliquez sur ce lien pour choisir un nouveau mot de passe :

${params.resetUrl}

Ce lien expire dans ${params.expiresInMinutes} minutes.
Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.`;

  return {
    subject: "LorIAx — Réinitialisation de mot de passe",
    html,
    text,
  };
}
