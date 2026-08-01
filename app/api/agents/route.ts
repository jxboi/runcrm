import { NextRequest, NextResponse } from "next/server";
import { createAgent, listAgents } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listAgents());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.name?.trim()) {
      return NextResponse.json({ error: "Agent name is required" }, { status: 400 });
    }
    return NextResponse.json(createAgent(body), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid request" }, { status: 400 });
  }
}
