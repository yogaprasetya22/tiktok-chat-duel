import { NextResponse } from "next/server";
import { tiktokService } from "@/src/lib/server/tiktok";

export async function GET() {
  return NextResponse.json({
    connected: tiktokService.isConnected(),
    username: tiktokService.getCurrentUsername(),
  });
}
