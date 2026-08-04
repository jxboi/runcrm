import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceSettings, updateWorkspaceSettings } from "@/lib/routines";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getWorkspaceSettings());
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json(await updateWorkspaceSettings(String(body.timezone ?? "")));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}
