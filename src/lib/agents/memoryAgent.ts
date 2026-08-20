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

export async function getSuggestions(projectId: string, queryKeywords: string[]) {
  try {
    // Memoria acotada al proyecto actual (sin fuga entre proyectos).
    const insights = await db.memoryInsight.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (queryKeywords.length === 0) {
      // Sin GAPS activos: mostrar los insights más recientes como contexto.
      return insights.slice(0, 3);
    }

    return insights.filter(insight =>
      queryKeywords.some(keyword => insight.keywords.includes(keyword.toLowerCase()))
    );
  } catch (error) {
    console.error("Error al obtener sugerencias:", error);
    return [];
  }
}
