import { NextRequest, NextResponse } from "next/server";
import { getWorkflow, listWorkflowVersions } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const workflowId = Number(id);
  if (!(await getWorkflow(workflowId))) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  return NextResponse.json(await listWorkflowVersions(workflowId));
}
