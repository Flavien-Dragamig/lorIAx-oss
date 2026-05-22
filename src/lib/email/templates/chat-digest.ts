interface DigestChannel {
  name: string;
  unreadCount: number;
  lastMessage: string;
  lastAuthor: string;
}

interface ChatDigestEmailOptions {
  recipientName: string;
  channels: DigestChannel[];
  appUrl: string;
}

export function chatDigestEmailHtml(opts: ChatDigestEmailOptions): string {
  const rows = opts.channels
    .map(
      (c) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
          <strong>${c.name}</strong>
          <span style="color:#9B9B9B;font-size:12px;margin-left:8px;">${c.unreadCount} message${c.unreadCount > 1 ? "s" : ""} non lu${c.unreadCount > 1 ? "s" : ""}</span>
          <br>
          <span style="font-size:13px;color:#555;">${c.lastAuthor} : ${c.lastMessage.slice(0, 80)}${c.lastMessage.length > 80 ? "…" : ""}</span>
        </td>
      </tr>`
    )
    .join("");

  return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#37352F;">Vos messages non lus — LorIAx</h2>
      <p>Bonjour ${opts.recipientName},</p>
      <p>Vous avez des messages non lus dans ${opts.channels.length} canal${opts.channels.length > 1 ? "x" : ""} :</p>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <p style="margin-top:24px;">
        <a href="${opts.appUrl}" style="background:#2F6EEB;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
          Ouvrir LorIAx
        </a>
      </p>
      <p style="color:#9B9B9B;font-size:12px;margin-top:32px;">
        Vous recevez cet email car vous avez des messages non lus. Modifiez vos préférences dans Paramètres → Notifications.
      </p>
    </div>`;
}
