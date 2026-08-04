import { NextResponse } from "next/server";
import { listRoutineRuns } from "@/lib/routines";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listRoutineRuns());
}
