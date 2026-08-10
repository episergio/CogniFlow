import { db } from "@/lib/db";

export async function saveInsight(projectId: string, type: string, content: string, keywords: string) {
  try {
    return await db.memoryInsight.create({
      data: {
        projectId,
        type,
        content,
        keywords: keywords.toLowerCase(),
      },
    });
  } catch (error) {
    console.error("Error al guardar insight:", error);
  }
}

export async function getSuggestions(queryKeywords: string[]) {
  try {
    const insights = await db.memoryInsight.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    
    // Búsqueda simple en memoria
    return insights.filter(insight => 
      queryKeywords.some(keyword => insight.keywords.includes(keyword.toLowerCase()))
    );
  } catch (error) {
    console.error("Error al obtener sugerencias:", error);
    return [];
  }
}
