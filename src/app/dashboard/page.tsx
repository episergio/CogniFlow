import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const projects = await db.project.findMany({
    where: { ownerId: user.id },
    include: { gaps: true, iterations: true }
  });

  const total = projects.length;
  const withGaps = projects.filter(p => p.status === "GAPS_PENDING").length;
  const completed = projects.filter(p => p.status === "COMPLETED").length;
  const avgIterations = total > 0 ? (projects.reduce((acc, p) => acc + p.iterations.length, 0) / total).toFixed(1) : "0";

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">CogniFlow</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-300">Hola, {user.name}</span>
          <form action={logoutAction}>
            <button className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded transition-colors">
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 mt-6">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Tus Proyectos</h2>
          <Link
            href="/projects/new"
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            + Nuevo Proyecto
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <p className="text-gray-400 text-sm">Total Proyectos</p>
            <p className="text-3xl font-bold text-white mt-1">{total}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <p className="text-gray-400 text-sm">Con GAPS Pendientes</p>
            <p className="text-3xl font-bold text-amber-400 mt-1">{withGaps}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <p className="text-gray-400 text-sm">Completados</p>
            <p className="text-3xl font-bold text-emerald-400 mt-1">{completed}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <p className="text-gray-400 text-sm">Promedio Iteraciones</p>
            <p className="text-3xl font-bold text-blue-400 mt-1">{avgIterations}</p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-sm font-semibold text-gray-300">Nombre</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-300">Cliente</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-300">Estado</th>
                <th className="px-6 py-3 text-sm font-semibold text-gray-300 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                    No tienes proyectos creados.
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-750 transition-colors">
                    <td className="px-6 py-4 font-medium">{project.name}</td>
                    <td className="px-6 py-4 text-gray-400">{project.client || "-"}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        project.status === "COMPLETED" ? "bg-emerald-900/50 text-emerald-300" :
                        project.status === "ESCALATED" ? "bg-red-900/50 text-red-300" :
                        "bg-blue-900/50 text-blue-300"
                      }`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Ver Detalle →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
