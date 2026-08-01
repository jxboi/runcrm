import { NextRequest, NextResponse } from "next/server";
import { createContact, listContacts } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return NextResponse.json(
    listContacts({ query: searchParams.get("q") ?? undefined, status: searchParams.get("status") ?? undefined })
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json(createContact(body), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid request" }, { status: 400 });
  }
}
