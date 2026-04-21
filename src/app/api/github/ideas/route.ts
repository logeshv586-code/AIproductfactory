import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/github/ideas - List saved ideas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: any = {};
    if (status) where.status = status;

    const ideas = await db.productIdea.findMany({
      where,
      include: { inspiredByRepos: { include: { repo: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      count: ideas.length,
      ideas: ideas.map((idea) => ({
        id: idea.id,
        title: idea.title,
        tagline: idea.tagline,
        description: idea.description,
        targetAudience: idea.targetAudience,
        keyFeatures: JSON.parse(idea.keyFeatures),
        techStack: JSON.parse(idea.techStack),
        marketPotential: idea.marketPotential,
        difficulty: idea.difficulty,
        monetization: JSON.parse(idea.monetization),
        uniqueValue: idea.uniqueValue,
        strategy: idea.strategy,
        status: idea.status,
        rating: idea.rating,
        notes: idea.notes,
        createdAt: idea.createdAt,
        inspiredBy: idea.inspiredByRepos.map((ir) => ({
          name: ir.repo.fullName,
          stars: ir.repo.stargazersCount,
        })),
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/github/ideas - Save a generated idea
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      tagline,
      description,
      targetAudience,
      keyFeatures,
      techStack,
      marketPotential,
      difficulty,
      monetization,
      uniqueValue,
      strategy,
      inspiredByRepoIds,
    } = body;

    const idea = await db.productIdea.create({
      data: {
        title,
        tagline,
        description,
        targetAudience,
        keyFeatures: JSON.stringify(keyFeatures),
        techStack: JSON.stringify(techStack),
        marketPotential: marketPotential || "medium",
        difficulty: difficulty || "intermediate",
        monetization: JSON.stringify(monetization),
        uniqueValue,
        strategy: strategy || "all",
        status: "saved",
      },
    });

    // Link to inspiring repos if provided
    if (inspiredByRepoIds && Array.isArray(inspiredByRepoIds)) {
      for (const repoId of inspiredByRepoIds) {
        await db.ideaInspiration.create({
          data: { ideaId: idea.id, repoId },
        }).catch(() => {}); // Skip if already linked
      }
    }

    return NextResponse.json({ success: true, idea });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH /api/github/ideas - Update an idea
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, rating, notes } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Idea ID required" }, { status: 400 });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (rating !== undefined) updateData.rating = rating;
    if (notes !== undefined) updateData.notes = notes;

    const idea = await db.productIdea.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, idea });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
