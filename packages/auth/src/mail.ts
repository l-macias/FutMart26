export type AuthMailMessage =
  | {
      type: "EMAIL_VERIFICATION";
      recipient: string;
      url: string;
    }
  | {
      type: "PASSWORD_RESET";
      recipient: string;
      url: string;
    };

export interface AuthMailService {
  send(message: AuthMailMessage): Promise<void>;
}

export class InMemoryAuthMailService implements AuthMailService {
  readonly messages: AuthMailMessage[] = [];

  send(message: AuthMailMessage) {
    this.messages.push(message);
    return Promise.resolve();
  }
}

export function createDevelopmentAuthMailService(): AuthMailService {
  return {
    send(message) {
      const recipient = maskEmail(message.recipient);
      console.info(`[auth-mail:development] ${message.type} ${recipient}`);
      console.info(message.url);
      return Promise.resolve();
    },
  };
}

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}
