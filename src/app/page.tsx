import Link from "next/link";
import { getUser } from "@/lib/auth";

export default async function Home() {
  const user = await getUser();

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-3xl text-center">
        <h1 className="text-5xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
          CogniFlow
        </h1>
        <p className="text-xl text-gray-300 mb-10">
          Sistema cognitivo MVP para análisis funcional, validación de requisitos y detección de GAPS de calidad.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {user ? (
            <Link
              href="/dashboard"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-full transition-all shadow-lg hover:shadow-blue-500/30"
            >
              Ir al Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-full transition-all shadow-lg hover:shadow-blue-500/30"
            >
              Iniciar Sesión (Demo)
            </Link>
          )}
          
          <Link
            href="/entrega-final"
            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-8 rounded-full transition-all border border-gray-600"
          >
            Evidencia / Entrega Final
          </Link>
          
          <a
            href={process.env.NEXT_PUBLIC_GITHUB_URL || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-full transition-all border border-gray-600"
          >
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
