import { wrapInLayout } from "./base-layout";

interface AccountCreatedParams {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
}

export function accountCreatedEmail(params: AccountCreatedParams) {
  const html = wrapInLayout(`
    <h2 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#18181b;">
      Votre compte LorIAx a été créé
    </h2>
    <p style="margin:0 0 16px;font-size:14px;color:#3f3f46;line-height:1.6;">
      Bonjour <strong>${params.name}</strong>,<br>
      Un administrateur vous a créé un compte sur LorIAx. Voici vos identifiants de connexion.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;width:100%;background:#f4f4f5;border-radius:8px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 8px;font-size:13px;color:#71717a;">Email</p>
          <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#18181b;">${params.email}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#71717a;">Mot de passe temporaire</p>
          <p style="margin:0;font-size:14px;font-weight:600;color:#18181b;font-family:monospace;">${params.password}</p>
        </td>
      </tr>
    </table>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
      <tr>
        <td style="background-color:#18181b;border-radius:8px;padding:12px 24px;">
          <a href="${params.loginUrl}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">
            Se connecter
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
      Nous vous recommandons de modifier votre mot de passe après votre première connexion.
    </p>
  `);

  const text = `Bonjour ${params.name},

Un administrateur vous a créé un compte sur LorIAx.

Email : ${params.email}
Mot de passe : ${params.password}

Connectez-vous ici : ${params.loginUrl}

Nous vous recommandons de modifier votre mot de passe après votre première connexion.`;

  return {
    subject: "LorIAx — Votre compte a été créé",
    html,
    text,
  };
}
