import { NextRequest, NextResponse } from "next/server";
import { tiktokService } from "@/src/lib/server/tiktok";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    // Create a custom readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Add this client to the broadcast list
        const removeClient = tiktokService.addClient(controller);

        // Send initial connection message
        controller.enqueue(
          `data: ${JSON.stringify({
            type: "status",
            message: "Connected to event stream",
            connected: tiktokService.isConnected(),
            timestamp: new Date().toISOString(),
          })}\n\n`
        );

        // Handle client disconnect
        request.signal.addEventListener("abort", () => {
          removeClient();
          controller.close();
        });
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Stream error";
    // console.error("SSE Error:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
