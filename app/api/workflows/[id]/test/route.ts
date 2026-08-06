import { NextRequest, NextResponse } from "next/server";
import { testWorkflow } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await req.json().catch(() => ({}))) as { input?: Record<string, unknown> };
    return NextResponse.json(await testWorkflow(Number(id), body.input));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not test workflow" }, { status: 400 });
  }
}
