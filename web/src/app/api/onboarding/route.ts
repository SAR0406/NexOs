import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    businessName?: string;
    niche?: string;
    revenueModel?: string;
  };

  if (!body.businessName) {
    return NextResponse.json({ error: "businessName is required" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    profile: {
      businessName: body.businessName,
      niche: body.niche ?? "Unknown",
      revenueModel: body.revenueModel ?? "Unknown",
    },
  });
}
