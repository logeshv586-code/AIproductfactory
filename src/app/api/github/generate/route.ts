// ============================================================
// POST /api/github/generate
// Generate products using intent-based repo selection + Graphify
// New endpoint that accepts a user idea and runs the full pipeline
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { runEnhancedPipeline } from "@/engine/pipeline";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idea, repos } = body as { idea: string; repos?: any[] };

    if (!idea || idea.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: "Please provide a product idea (at least 3 characters)" },
        { status: 400 }
      );
    }

    // If repos are provided, use them; otherwise we'd fetch from GitHub
    // (The frontend typically sends repos from the Explorer tab)
    const inputRepos = repos || [];

    if (inputRepos.length === 0) {
      return NextResponse.json(
        { success: false, error: "No repos available. Please fetch repos first from the Explorer tab." },
        { status: 400 }
      );
    }

    const result = await runEnhancedPipeline(inputRepos, idea);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Generate pipeline error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
