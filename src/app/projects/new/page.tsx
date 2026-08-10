"use client";

import { useActionState, useEffect } from "react";
import { createProjectAction } from "@/app/actions/project";
import { useRouter } from "next/navigation";
import Link from "next/link";

const initialState = {
  error: "",
  success: false,
  projectId: "",
};

export default function NewProjectPage() {
  const [state, formAction, isPending] = useActionState(createProjectAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success && state.projectId) {
      router.push(`/projects/${state.projectId}`);
    }
  }, [state.success, state.projectId, router]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-2xl mx-auto mt-10">
        <Link href="/dashboard" className="text-gray-400 hover:text-white mb-6 inline-block">
          ← Volver al Dashboard
        </Link>
        
        <div className="bg-gray-800 rounded-xl shadow-xl p-8 border border-gray-700">
          <h1 className="text-3xl font-bold mb-6">Crear Nuevo Proyecto</h1>
          
          <form action={formAction} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Nombre del Proyecto</label>
              <input
                type="text"
                name="name"
                required
                placeholder="Ej: Sistema de Facturación"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Cliente</label>
              <input
                type="text"
                name="client"
                placeholder="Ej: Empresa S.A."
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Prioridad</label>
              <select
                name="priority"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Media</option>
                <option value="BAJA">Baja</option>
              </select>
            </div>

            {state.error && (
              <div className="text-red-400 text-sm">{state.error}</div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 mt-4"
            >
              {isPending ? "Creando..." : "Crear Proyecto"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
