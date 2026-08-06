import { NextRequest, NextResponse } from "next/server";
import { createSalesRep, listSalesReps } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listSalesReps());
}

export async function POST(req: NextRequest) {
  try {
    return NextResponse.json(await createSalesRep(await req.json()), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid request" }, { status: 400 });
  }
}
