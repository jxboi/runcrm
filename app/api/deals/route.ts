import { NextRequest, NextResponse } from "next/server";
import { createDeal, listDeals } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contact_id");
  return NextResponse.json(
    listDeals({
      stage: searchParams.get("stage") ?? undefined,
      contact_id: contactId ? Number(contactId) : undefined,
    })
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json(createDeal(body), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid request" }, { status: 400 });
  }
}
