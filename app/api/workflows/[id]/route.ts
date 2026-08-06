import { NextRequest, NextResponse } from "next/server";
import { getWorkflow } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const workflow = await getWorkflow(Number(id));
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  return NextResponse.json(workflow);
}
