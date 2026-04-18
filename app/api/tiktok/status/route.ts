import { NextResponse } from "next/server";
import { tiktokService } from "@/src/lib/tiktok/tiktokService";

export async function GET() {
  return NextResponse.json({
    connected: tiktokService.isConnected(),
    username: tiktokService.getCurrentUsername(),
  });
}
