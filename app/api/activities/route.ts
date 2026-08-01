import { NextRequest, NextResponse } from "next/server";
import { listActivities } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contact_id");
  const dealId = searchParams.get("deal_id");
  return NextResponse.json(
    await listActivities({
      contact_id: contactId ? Number(contactId) : undefined,
      deal_id: dealId ? Number(dealId) : undefined,
    })
  );
}
