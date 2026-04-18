import { NextRequest, NextResponse } from "next/server";
import { tiktokService } from "@/src/lib/tiktok/tiktokService";

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();

    // Validate username
    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    // Normalize username: remove @ if present, trim whitespace
    let normalizedUsername = String(username).trim();
    if (normalizedUsername.startsWith("@")) {
      normalizedUsername = normalizedUsername.slice(1);
    }

    // Validate username format (alphanumeric, dots, underscores, hyphens)
    if (!/^[a-zA-Z0-9._-]+$/.test(normalizedUsername)) {
      return NextResponse.json(
        { 
          error: "Invalid username format. Use only alphanumeric characters, dots, underscores, and hyphens",
          received: normalizedUsername
        },
        { status: 400 }
      );
    }

    // Check minimum length
    if (normalizedUsername.length < 2) {
      return NextResponse.json(
        { error: "Username must be at least 2 characters long" },
        { status: 400 }
      );
    }

    console.log("[TikTok Connect] Attempting to connect with username:", normalizedUsername);

    await tiktokService.connect(normalizedUsername);
    return NextResponse.json({
      success: true,
      message: `Connected to @${normalizedUsername}`,
      username: normalizedUsername,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Connection failed";
    console.error("[TikTok Connect] Connection error:", errorMessage);
    
    // Provide helpful hints based on error type
    let hint = "";
    if (errorMessage.includes("UNIQUEID") || errorMessage.includes("uniqueId")) {
      hint = " | HINT: Check if the TikTok account exists and the username is correct. Try the /api/tiktok/validate-username endpoint first.";
    } else if (errorMessage.includes("timeout") || errorMessage.includes("Timeout")) {
      hint = " | HINT: Connection timed out. The TikTok account might not be live or there's a network issue.";
    }

    return NextResponse.json(
      { 
        error: errorMessage + hint,
        type: error instanceof Error ? error.constructor.name : "UnknownError"
      },
      { status: 500 }
    );
  }
}
