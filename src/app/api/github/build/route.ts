// ============================================================
// POST /api/github/build
// Generate starter repo scaffold data (enhanced with full blueprint)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { generateStarterRepo } from "@/engine/starterRepo";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product, variant = "intermediate" } = body;

    if (!product) {
      return NextResponse.json(
        { success: false, error: "No product data provided" },
        { status: 400 }
      );
    }

    const buildVariant = product.buildVariants?.find(
      (v: any) => v.tier === variant
    ) || product.buildVariants?.[1];

    if (!buildVariant) {
      return NextResponse.json(
        { success: false, error: "No build variant found" },
        { status: 400 }
      );
    }

    // Generate full starter repo using the enhanced generator
    const scaffold = generateStarterRepo(product, variant);

    return NextResponse.json({
      success: true,
      scaffold,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
