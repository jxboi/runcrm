import { NextResponse } from "next/server";
import { listPendingProposals } from "@/lib/proposals";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listPendingProposals());
}
