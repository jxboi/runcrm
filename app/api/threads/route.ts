import { NextRequest, NextResponse } from "next/server";
import { createAccountThread, createConversationThread, listThreads } from "@/lib/crm";
import { ThreadFilter } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requested = req.nextUrl.searchParams.get("filter");
  const filter: ThreadFilter = requested === "all" || requested === "archived" ? requested : "active";
  return NextResponse.json(await listThreads(filter));
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
