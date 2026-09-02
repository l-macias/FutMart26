import nodemailer from "nodemailer";

import type { AuthMailMessage, AuthMailService } from "./mail.js";

export interface SmtpAuthMailConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
}

export function createSmtpAuthMailService(
  config: SmtpAuthMailConfig,
): AuthMailService {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.user && config.password
      ? { auth: { user: config.user, pass: config.password } }
      : {}),
  });

  return {
    async send(message) {
      const content = messageContent(message);
      await transport.sendMail({
        from: config.from,
        to: message.recipient,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
    },
  };
}

function messageContent(message: AuthMailMessage) {
  const action =
    message.type === "EMAIL_VERIFICATION"
      ? {
          subject: "Verificá tu cuenta de F5 Groups",
          intro: "Verificá tu email para activar tu cuenta.",
          label: "Verificar cuenta",
        }
      : {
          subject: "Restablecé tu contraseña de F5 Groups",
          intro: "Recibimos una solicitud para restablecer tu contraseña.",
          label: "Restablecer contraseña",
        };
  const safeUrl = escapeHtml(message.url);
  return {
    subject: action.subject,
    text: `${action.intro}\n\n${message.url}\n\nSi no solicitaste esta acción, ignorá este mensaje.`,
    html: `<p>${action.intro}</p><p><a href="${safeUrl}">${action.label}</a></p><p>Si no solicitaste esta acción, ignorá este mensaje.</p>`,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
