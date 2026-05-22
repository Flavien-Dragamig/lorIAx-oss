import { wrapInLayout } from "./base-layout";

interface InvitationTemplateParams {
  inviterName: string;
  spaceName: string;
  acceptUrl: string;
}

export function invitationEmail(params: InvitationTemplateParams) {
  const html = wrapInLayout(`
    <h2 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#18181b;">
      Invitation à rejoindre un espace
    </h2>
    <p style="margin:0 0 16px;font-size:14px;color:#3f3f46;line-height:1.6;">
      <strong>${params.inviterName}</strong> vous invite à rejoindre l'espace
      <strong>${params.spaceName}</strong> sur LorIAx.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
      <tr>
        <td style="background-color:#18181b;border-radius:8px;padding:12px 24px;">
          <a href="${params.acceptUrl}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">
            Accéder à l'espace
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
      Si vous n'avez pas de compte LorIAx, vous devrez en créer un.
    </p>
  `);

  const text = `${params.inviterName} vous invite à rejoindre l'espace « ${params.spaceName} » sur LorIAx.

Accédez à l'espace : ${params.acceptUrl}`;

  return {
    subject: `LorIAx — ${params.inviterName} vous invite dans « ${params.spaceName} »`,
    html,
    text,
  };
}
