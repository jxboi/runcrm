import { NextRequest, NextResponse } from "next/server";
import { insertMessage, listMessages } from "@/lib/crm";
import { TraceEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listMessages());
}

/**
 * Append a message to the shared chat. Used by the client to persist the
 * partial reply it streamed when the user stops a run mid-flight — the server
 * deliberately skips persisting in that case, so there is exactly one writer.
 */
export async function POST(req: NextRequest) {
  let body: {
    role?: string;
    agent_id?: number | null;
    content?: string;
    trace?: TraceEntry[];
    is_error?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!content) return NextResponse.json({ error: "Message content is required" }, { status: 400 });
  if (body.role !== "user" && body.role !== "agent") {
    return NextResponse.json({ error: 'role must be "user" or "agent"' }, { status: 400 });
  }

  return NextResponse.json(
    await insertMessage({
      role: body.role,
      agent_id: body.agent_id ?? null,
      content,
      trace: Array.isArray(body.trace) ? body.trace : [],
      is_error: Boolean(body.is_error),
    }),
    { status: 201 }
  );
}
