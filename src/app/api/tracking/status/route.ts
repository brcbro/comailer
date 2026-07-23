import { NextResponse } from "next/server";
import { getTrackingBaseUrl, isPublicTrackingBase } from "@/lib/tracking";

export async function GET() {
  const appUrl = getTrackingBaseUrl();
  return NextResponse.json({
    appUrl,
    isPublic: isPublicTrackingBase(appUrl),
  });
}
