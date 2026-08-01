import { NextRequest, NextResponse } from "next/server";
import { createTask, listTasks } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return NextResponse.json(listTasks({ status: searchParams.get("status") ?? undefined }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json(createTask(body), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid request" }, { status: 400 });
  }
}
