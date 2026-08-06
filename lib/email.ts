const TEMPLATE_PATTERN = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ResolvedWorkflowEmail {
  to: string[];
  subject: string;
  text: string;
  replyTo?: string;
}

function readPath(value: Record<string, unknown>, path: string): unknown {
  let current: unknown = value;
  for (const key of path.split(".").filter(Boolean)) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function resolveTemplate(template: string, input: Record<string, unknown>, field: string): string {
  return template.replace(TEMPLATE_PATTERN, (_match, path: string) => {
    const value = readPath(input, path);
    if (value === undefined || value === null || value === "") {
      throw new Error(`Email ${field} could not resolve {{${path}}} from the workflow input.`);
    }
    if (typeof value === "object") {
      throw new Error(`Email ${field} placeholder {{${path}}} must resolve to text or a number.`);
    }
    return String(value);
  });
}

function recipientTemplates(value: unknown): string[] {
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  return [];
}

export function resolveWorkflowEmail(
  config: Record<string, unknown>,
  input: Record<string, unknown>
): ResolvedWorkflowEmail {
  const to = recipientTemplates(config.to).map((recipient) => resolveTemplate(recipient, input, "recipient"));
  if (to.length === 0) throw new Error("Email recipient is required.");
  if (to.length > 50) throw new Error("A workflow email can have at most 50 recipients.");
  const invalid = to.find((recipient) => !EMAIL_PATTERN.test(recipient));
  if (invalid) throw new Error(`Email recipient “${invalid}” is not a valid address.`);

  const subjectTemplate = typeof config.subject === "string" ? config.subject.trim() : "";
  if (!subjectTemplate) throw new Error("Email subject is required.");
  const subject = resolveTemplate(subjectTemplate, input, "subject").trim();

  const bodyTemplate = typeof config.body === "string"
    ? config.body
    : typeof config.text === "string"
      ? config.text
      : "";
  if (!bodyTemplate.trim()) throw new Error("Email body is required.");
  const text = resolveTemplate(bodyTemplate, input, "body");

  const replyToTemplate = typeof config.reply_to === "string" ? config.reply_to.trim() : "";
  const replyTo = replyToTemplate ? resolveTemplate(replyToTemplate, input, "reply-to address") : undefined;
  if (replyTo && !EMAIL_PATTERN.test(replyTo)) throw new Error(`Email reply-to address “${replyTo}” is not valid.`);

  return { to, subject, text, ...(replyTo ? { replyTo } : {}) };
}

function runtimeSetting(name: "RESEND_API_KEY" | "RESEND_FROM_EMAIL"): string {
  return process.env[name]?.trim() ?? "";
}

export function emailConfigurationError(): string | null {
  if (!runtimeSetting("RESEND_API_KEY")) return "Email sending needs a RESEND_API_KEY.";
  if (!runtimeSetting("RESEND_FROM_EMAIL")) return "Email sending needs a verified RESEND_FROM_EMAIL sender address.";
  return null;
}

export async function sendWorkflowEmail(input: {
  config: Record<string, unknown>;
  workflowInput: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<{ id: string; recipients: string[] }> {
  const configurationError = emailConfigurationError();
  if (configurationError) throw new Error(configurationError);

  const email = resolveWorkflowEmail(input.config, input.workflowInput);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtimeSetting("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: runtimeSetting("RESEND_FROM_EMAIL"),
      to: email.to,
      subject: email.subject,
      text: email.text,
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    }),
  });

  const result = await response.json().catch(() => ({})) as { id?: string; message?: string; error?: { message?: string } };
  if (!response.ok || !result.id) {
    throw new Error(result.message || result.error?.message || `Email provider rejected the request (${response.status}).`);
  }
  return { id: result.id, recipients: email.to };
}
