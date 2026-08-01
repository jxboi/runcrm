import { NextResponse } from "next/server";
import { listMessages } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listMessages());
}
