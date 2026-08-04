import { NextRequest, NextResponse } from "next/server";
import { createAccountThread, createConversationThread, listThreads } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listThreads());
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { accountName?: string };

  try {
    const thread = body.accountName?.trim()
      ? await createAccountThread(body.accountName)
      : await createConversationThread();
    return NextResponse.json(thread, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start that conversation" },
      { status: 400 }
    );
  }
}
