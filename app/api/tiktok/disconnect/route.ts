import { NextRequest, NextResponse } from "next/server";
import { tiktokService } from "@/src/lib/tiktok/tiktokService";

export async function POST(_request: NextRequest) {
  try {
    await tiktokService.disconnect();
    return NextResponse.json({
      success: true,
      message: "Disconnected from TikTok Live",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Disconnect failed";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
