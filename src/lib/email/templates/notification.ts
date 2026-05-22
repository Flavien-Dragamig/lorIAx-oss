import { wrapInLayout } from "./base-layout";

interface NotificationTemplateParams {
  userName: string;
  actorName: string;
  type: "mention" | "comment" | "reply" | "share" | "calendar_reminder" | "calendar_invitation" | "task_assigned" | "chat_message";
  documentTitle: string;
  documentUrl: string;
  message?: string;
}

const typeLabels: Record<string, string> = {
  mention: "vous a mentionné dans",
  comment: "a commenté",
  reply: "a répondu à votre commentaire dans",
  share: "a partagé avec vous",
  calendar_reminder: "Rappel :",
  calendar_invitation: "vous invite à",
  task_assigned: "vous a assigné une tâche dans",
  chat_message: "vous a envoyé un message",
};

export function notificationEmail(params: NotificationTemplateParams) {
  const action = typeLabels[params.type] || "a interagi avec";

  const html = wrapInLayout(`
    <h2 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#18181b;">
      Nouvelle notification
    </h2>
    <p style="margin:0 0 16px;font-size:14px;color:#3f3f46;line-height:1.6;">
      Bonjour ${params.userName},
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#3f3f46;line-height:1.6;">
      <strong>${params.actorName}</strong> ${action}
      <strong>${params.documentTitle}</strong>.
    </p>
    ${
      params.message
        ? `<div style="margin:0 0 24px;padding:12px 16px;background-color:#f4f4f5;border-radius:8px;border-left:3px solid #a1a1aa;">
            <p style="margin:0;font-size:13px;color:#3f3f46;line-height:1.5;">${params.message}</p>
          </div>`
        : ""
    }
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
      <tr>
        <td style="background-color:#18181b;border-radius:8px;padding:12px 24px;">
          <a href="${params.documentUrl}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">
            Voir le document
          </a>
        </td>
      </tr>
    </table>
  `);

  const text = `Bonjour ${params.userName},

${params.actorName} ${action} « ${params.documentTitle} ».
${params.message ? `\n« ${params.message} »\n` : ""}
Voir le document : ${params.documentUrl}`;

  return {
    subject: `LorIAx — ${params.actorName} ${action} « ${params.documentTitle} »`,
    html,
    text,
  };
}
