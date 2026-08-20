import Link from "next/link";

export default function EntregaFinalPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-gray-400 hover:text-white">← Volver al inicio</Link>
        </div>
        
        <h1 className="text-4xl font-bold text-white mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
          CogniFlow - Entrega Final
        </h1>

        <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">1. Resumen Ejecutivo</h2>
          <p className="text-gray-300 leading-relaxed">
            CogniFlow MVP es una prueba de concepto académica que demuestra cómo un sistema cognitivo puede
            asistir en la validación y refinamiento de requisitos de software (Análisis Funcional).
            El sistema ingesta requisitos, utiliza un motor de reglas (Agente ACCR) para detectar ambigüedades y faltantes,
            iterando con el usuario para resolverlos, y finalmente generando artefactos base (SRS y diagrama de flujo).
          </p>
        </section>

        <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">2. Links del Proyecto</h2>
          <ul className="list-disc pl-5 space-y-2 text-blue-400">
            <li><a href={process.env.NEXT_PUBLIC_GITHUB_URL || "#"} target="_blank" className="hover:underline">Repositorio GitHub</a></li>
            <li><a href={process.env.NEXT_PUBLIC_APP_URL || "#"} target="_blank" className="hover:underline">Demo Deployed</a></li>
          </ul>
        </section>

        <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">3. Tecnologías y Arquitectura</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-2">Tecnología</th>
                  <th className="px-4 py-2">Uso en MVP</th>
                  <th className="px-4 py-2">Justificación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                <tr>
                  <td className="px-4 py-3 font-semibold text-white">Next.js (App Router)</td>
                  <td className="px-4 py-3">Frontend y Backend (Server Actions)</td>
                  <td className="px-4 py-3">Desarrollo unificado, tipado fuerte (TS) y despliegue simple.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-white">Prisma + SQLite</td>
                  <td className="px-4 py-3">Persistencia local</td>
                  <td className="px-4 py-3">ORM rápido, fácil configuración sin requerir Docker para BD.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-white">Tailwind CSS</td>
                  <td className="px-4 py-3">Estilos UI</td>
                  <td className="px-4 py-3">Prototipado rápido de interfaces modernas.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-white">React Markdown & Mermaid</td>
                  <td className="px-4 py-3">Visualización de artefactos</td>
                  <td className="px-4 py-3">Renderizado directo de outputs documentales generados por IA/Reglas.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">4. Criterios de Aceptación (Checklist)</h2>
          <ul className="space-y-2 text-gray-300">
            <li className="flex items-center gap-2">✅ Sistema ejecutable en local sin errores.</li>
            <li className="flex items-center gap-2">✅ Inicio de sesión de usuario Demo (sesión firmada HMAC).</li>
            <li className="flex items-center gap-2">✅ Creación de proyecto.</li>
            <li className="flex items-center gap-2">✅ Carga de requisitos demo y propios (JSON validado con Zod).</li>
            <li className="flex items-center gap-2">✅ Detección de GAPS con severidad por Agente ACCR.</li>
            <li className="flex items-center gap-2">✅ Responder GAPS aplica la respuesta al requisito; re-análisis en nuevas iteraciones (máx. 5, luego escala a humano).</li>
            <li className="flex items-center gap-2">✅ GAPS críticos abiertos bloquean la generación en servidor.</li>
            <li className="flex items-center gap-2">✅ Generación de SRS, Matriz de Trazabilidad y Diagrama Mermaid renderizado en el navegador.</li>
            <li className="flex items-center gap-2">✅ Registro de logs (Agente de Auditoría) con exportación a CSV.</li>
            <li className="flex items-center gap-2">✅ Fallback local sin API LLM real; LLM opcional con fallback a reglas.</li>
          </ul>
        </section>

        <section className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">5. Seguridad MVP</h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-300">
            <li><strong>Autenticación:</strong> Hasheo de contraseña con bcryptjs, cookies HttpOnly firmadas con HMAC-SHA256 (SESSION_SECRET).</li>
            <li><strong>Protección de rutas:</strong> Middleware intercepta páginas protegidas.</li>
            <li><strong>Datos Demo:</strong> Solo se utiliza data sintética (cargada vía Prisma seed) para mitigar riesgos de fugas.</li>
            <li><strong>Server Actions:</strong> Lógica ejecutada en servidor, sin exposición de direct queries al cliente.</li>
          </ul>
        </section>

      </div>
    </div>
  );
}
