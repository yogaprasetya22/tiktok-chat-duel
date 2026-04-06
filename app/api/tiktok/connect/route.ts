import { NextRequest, NextResponse } from "next/server";
import { tiktokService } from "@/lib/server/tiktok";

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    await tiktokService.connect(username);
    return NextResponse.json({
      success: true,
      message: `Connected to @${username}`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
