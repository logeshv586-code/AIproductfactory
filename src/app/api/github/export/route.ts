// ============================================================
// POST /api/github/export
// Export product architecture as JSON/YAML (enhanced)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { generateExportData } from "@/engine/pipeline";
import YAML from "yaml";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product, format = "json" } = body;

    if (!product) {
      return NextResponse.json(
        { success: false, error: "No product data provided" },
        { status: 400 }
      );
    }

    const exportData = generateExportData(product);

    if (format === "yaml") {
      const yamlStr = YAML.stringify(exportData);
      return new NextResponse(yamlStr, {
        headers: {
          "Content-Type": "text/yaml",
          "Content-Disposition": `attachment; filename="${product.title?.toLowerCase().replace(/\s+/g, "-") || "product"}-architecture.yaml"`,
        },
      });
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${product.title?.toLowerCase().replace(/\s+/g, "-") || "product"}-architecture.json"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
