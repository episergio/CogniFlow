import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  loadDemoRequirementsAction, 
  analyzeProjectAction, 
  answerGapAction,
  generateArtifactsAction 
} from "@/app/actions/project";
import { getSuggestions } from "@/lib/agents/memoryAgent";
import ReactMarkdown from "react-markdown";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  
  const project = await db.project.findUnique({
    where: { id: id },
    include: {
      requirements: true,
      gaps: true,
      iterations: { orderBy: { number: 'desc' } },
      artifacts: true,
      auditLogs: { orderBy: { createdAt: 'desc' } },
    }
  });

  if (!project) return <div>Proyecto no encontrado</div>;

  const activeGaps = project.gaps.filter(g => g.status === "OPEN");
  const criticalGaps = activeGaps.filter(g => g.severity === "CRITICAL");
  const currentIteration = project.iterations[0];

  // Obtener sugerencias para memoria si hay GAPs activos
  const gapKeywords = activeGaps.map(g => g.type.toLowerCase());
  const suggestions = await getSuggestions(gapKeywords);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-gray-400 hover:text-white mr-4">← Volver</Link>
          <h1 className="text-2xl font-bold inline-block text-white">{project.name}</h1>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
          project.status === 'COMPLETED' ? 'bg-emerald-900 text-emerald-300' :
          project.status === 'ESCALATED' ? 'bg-red-900 text-red-300' :
          'bg-blue-900 text-blue-300'
        }`}>
          Estado: {project.status}
        </span>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Columna Izquierda: Requisitos e Iteraciones */}
        <div className="lg:col-span-2 space-y-6">
          
          <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Requisitos</h2>
              {project.requirements.length === 0 && (
                <form action={loadDemoRequirementsAction.bind(null, project.id)}>
                  <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm transition">
                    Cargar Requisitos Demo
                  </button>
                </form>
              )}
            </div>
            
            {project.requirements.length === 0 ? (
              <p className="text-gray-400 text-sm">No hay requisitos cargados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-2">ID</th>
                      <th className="px-4 py-2">Tipo</th>
                      <th className="px-4 py-2">Nombre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {project.requirements.map(r => (
                      <tr key={r.id} className="hover:bg-gray-750">
                        <td className="px-4 py-3">{r.externalId}</td>
                        <td className="px-4 py-3">
                          <span className="bg-gray-700 px-2 py-1 rounded text-xs">{r.type}</span>
                        </td>
                        <td className="px-4 py-3">{r.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">GAPS Detectados</h2>
              {project.requirements.length > 0 && project.status !== 'COMPLETED' && (
                <form action={analyzeProjectAction.bind(null, project.id)}>
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm transition">
                    Ejecutar Análisis
                  </button>
                </form>
              )}
            </div>

            {project.gaps.length === 0 ? (
              <p className="text-gray-400 text-sm">No se han detectado GAPS.</p>
            ) : (
              <div className="space-y-4">
                {project.gaps.map(gap => (
                  <div key={gap.id} className={`p-4 rounded-lg border ${gap.status === 'OPEN' ? 'border-amber-700 bg-amber-900/20' : 'border-emerald-700 bg-emerald-900/20'}`}>
                    <div className="flex justify-between mb-2">
                      <span className="font-semibold text-white">{gap.code} - {gap.type}</span>
                      <span className={`text-xs px-2 py-1 rounded ${gap.severity === 'CRITICAL' ? 'bg-red-900 text-red-300' : 'bg-amber-900 text-amber-300'}`}>
                        {gap.severity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mb-2">{gap.description}</p>
                    <p className="text-sm font-medium text-amber-200 mb-3">{gap.question}</p>
                    
                    {gap.status === 'OPEN' ? (
                      <form action={async (formData) => {
                        "use server";
                        const response = formData.get("response") as string;
                        await answerGapAction(gap.id, response, project.id);
                      }} className="flex gap-2">
                        <input name="response" type="text" required placeholder="Escribe tu respuesta..." className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white" />
                        <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm transition">Responder</button>
                      </form>
                    ) : (
                      <p className="text-sm text-emerald-300 bg-emerald-900/30 p-2 rounded">
                        <strong>Respuesta:</strong> {gap.response}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Artefactos */}
          <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Artefactos</h2>
              {project.status === 'READY_FOR_ARTIFACTS' && (
                <form action={generateArtifactsAction.bind(null, project.id)}>
                  <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-sm transition">
                    Generar Artefactos
                  </button>
                </form>
              )}
            </div>
            
            {project.artifacts.length === 0 ? (
              <p className="text-gray-400 text-sm">
                {project.status === 'READY_FOR_ARTIFACTS' 
                  ? "Listo para generar artefactos." 
                  : "Resuelve los GAPS críticos para generar artefactos."}
              </p>
            ) : (
              <div className="space-y-4">
                {project.artifacts.map(art => (
                  <div key={art.id} className="border border-gray-700 rounded-lg p-4 bg-gray-750">
                    <h3 className="font-semibold text-white mb-2">{art.title} ({art.type})</h3>
                    {art.format === 'markdown' ? (
                      <div className="prose prose-invert max-w-none text-sm bg-gray-900 p-4 rounded overflow-auto max-h-96">
                        <ReactMarkdown>{art.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="bg-gray-900 p-4 rounded overflow-auto">
                        <pre className="text-xs text-blue-300">{art.content}</pre>
                        <p className="text-xs text-gray-500 mt-2">* Pega este código en Mermaid Live Editor para visualizar</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

        {/* Columna Derecha: Insights, Iteraciones, Logs */}
        <div className="space-y-6">
          
          <section className="bg-blue-900/20 border border-blue-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-blue-300 mb-3 flex items-center gap-2">
              <span>🧠</span> Insights del Agente (Memoria)
            </h2>
            {suggestions.length === 0 ? (
              <p className="text-sm text-blue-200/60">No hay sugerencias para el contexto actual.</p>
            ) : (
              <ul className="space-y-2 text-sm text-blue-200">
                {suggestions.map((s, i) => (
                  <li key={i} className="bg-blue-900/40 p-2 rounded">💡 {s.content}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-3">Estado Actual</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Iteración:</span>
                <span className="font-medium text-white">{currentIteration?.number || 0} / 5</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">GAPS Totales:</span>
                <span className="font-medium text-amber-400">{project.gaps.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">GAPS Críticos:</span>
                <span className="font-medium text-red-400">{criticalGaps.length}</span>
              </div>
            </div>
          </section>

          <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-3">Auditoría</h2>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {project.auditLogs.map(log => (
                <div key={log.id} className="text-xs border-l-2 border-gray-600 pl-3 py-1">
                  <div className="flex justify-between text-gray-400 mb-1">
                    <span>{log.agent}</span>
                    <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-gray-300">{log.action}</p>
                </div>
              ))}
              {project.auditLogs.length === 0 && (
                <p className="text-sm text-gray-500">No hay logs registrados.</p>
              )}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
