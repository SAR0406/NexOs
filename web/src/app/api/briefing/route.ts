import { NextResponse } from "next/server";
import { getBriefing } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json(getBriefing());
}
