import { NextResponse } from "next/server";
import { getBusinessSummary } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({ alerts: getBusinessSummary().alerts });
}
