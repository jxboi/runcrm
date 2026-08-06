import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveWorkflowEmail, sendWorkflowEmail } from "./email";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
});

describe("workflow email", () => {
  it("resolves workflow input placeholders", () => {
    expect(resolveWorkflowEmail({
      to: "{{record.email}}",
      subject: "Welcome, {{record.name}}",
      body: "Your account {{record.id}} is ready.",
    }, {
      record: { id: 42, name: "Ari", email: "ari@example.com" },
    })).toEqual({
      to: ["ari@example.com"],
      subject: "Welcome, Ari",
      text: "Your account 42 is ready.",
    });
  });

  it("rejects missing template values before sending", () => {
    expect(() => resolveWorkflowEmail({
      to: "{{record.email}}",
      subject: "Welcome",
      body: "Hello",
    }, {})).toThrow("could not resolve {{record.email}}");
  });

  it("rejects invalid recipients", () => {
    expect(() => resolveWorkflowEmail({
      to: "not-an-email",
      subject: "Welcome",
      body: "Hello",
    }, {})).toThrow("not a valid address");
  });

  it("sends through Resend with an idempotency key", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "RunCRM <hello@example.com>";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email_123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendWorkflowEmail({
      config: { to: "ari@example.com", subject: "Hello", body: "Welcome" },
      workflowInput: {},
      idempotencyKey: "workflow-1-run-2-node-send",
    })).resolves.toEqual({ id: "email_123", recipients: ["ari@example.com"] });

    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Idempotency-Key": "workflow-1-run-2-node-send" }),
    }));
  });
});
