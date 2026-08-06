import { NextRequest, NextResponse } from "next/server";
import { getSalesRep, updateSalesRep } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const salesRep = await getSalesRep(Number(id));
  if (!salesRep) return NextResponse.json({ error: "Sales rep not found" }, { status: 404 });
  return NextResponse.json(salesRep);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await updateSalesRep(Number(id), await req.json()));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid request" }, { status: 400 });
  }
}
