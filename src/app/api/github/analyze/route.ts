// ============================================================
// POST /api/github/analyze
// Full multi-agent analysis pipeline (enhanced with Graphify)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { runEnhancedPipeline } from "@/engine/pipeline";

interface RepoInput {
  name: string;
  description: string | null;
  stars: number;
  language: string | null;
  topics: string[];
  category: string;
  trendScore: number;
  growthRate: number;
  innovationSignals: string[];
  url?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repos, focus } = body as { repos: RepoInput[]; focus?: string };

    if (!repos || repos.length === 0) {
      return NextResponse.json(
        { success: false, error: "No repos provided for analysis" },
        { status: 400 }
      );
    }

    const result = await runEnhancedPipeline(repos, focus);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Analysis pipeline error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
