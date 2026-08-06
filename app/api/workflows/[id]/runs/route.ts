import { NextRequest, NextResponse } from "next/server";
import { getWorkflow, listWorkflowRuns, runWorkflow } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const workflowId = Number(id);
  if (!(await getWorkflow(workflowId))) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  return NextResponse.json(await listWorkflowRuns(workflowId));
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await req.json().catch(() => ({}))) as { input?: Record<string, unknown> };
    return NextResponse.json(await runWorkflow(Number(id), body.input));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not run workflow" }, { status: 400 });
  }
}
