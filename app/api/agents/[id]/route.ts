import { NextRequest, NextResponse } from "next/server";
import { deleteAgent, updateAgent } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const agent = updateAgent(Number(id), body);
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    return NextResponse.json(agent);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ok = deleteAgent(Number(id));
  if (!ok) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
