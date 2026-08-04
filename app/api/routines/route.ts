import { NextRequest, NextResponse } from "next/server";
import { createRoutine, listRoutines } from "@/lib/routines";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return NextResponse.json(await listRoutines({ includeArchived: req.nextUrl.searchParams.get("archived") === "true" }));
}

export async function POST(req: NextRequest) {
  try {
    return NextResponse.json(await createRoutine(await req.json()), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}
