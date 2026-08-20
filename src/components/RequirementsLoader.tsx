"use client";

import { useActionState } from "react";
import {
  loadRequirementsFromJsonAction,
  type LoadRequirementsState,
} from "@/app/actions/project";

const initialState: LoadRequirementsState = {};

const EXAMPLE_JSON = `[
  {
    "externalId": "REQ-010",
    "type": "RF",
    "name": "Login de usuario",
    "description": "El sistema debe autenticar usuarios con email y contraseña.",
    "acceptanceCriteria": "El usuario ingresa credenciales válidas y accede en menos de 2 segundos.",
    "priority": "ALTA"
  },
  {
    "externalId": "RNF-001",
    "type": "RNF",
    "name": "Disponibilidad",
    "description": "El sistema debe mantener una disponibilidad del 99.5% mensual."
  }
]`;

export default function RequirementsLoader({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(
    loadRequirementsFromJsonAction,
    initialState
  );

  return (
    <div className="mt-4 border border-gray-700 rounded-lg p-4 bg-gray-900/60">
      <h3 className="text-sm font-semibold text-white mb-2">Cargar requisitos (JSON)</h3>
      <p className="text-xs text-gray-400 mb-3">
        Pegá un array JSON. Campos requeridos: <code>externalId</code>, <code>type</code>{" "}
        (RF | RNF | RN | HU | SUP), <code>name</code>, <code>description</code>.
        Para RF/HU conviene incluir <code>acceptanceCriteria</code>; para RN,{" "}
        <code>businessRule</code>.
      </p>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="projectId" value={projectId} />
        <textarea
          name="requirements"
          required
          rows={8}
          placeholder={EXAMPLE_JSON}
          defaultValue={EXAMPLE_JSON}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={isPending}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-1.5 rounded text-sm transition"
        >
          {isPending ? "Validando..." : "Validar y cargar requisitos"}
        </button>
      </form>

      {state.error && (
        <p className="text-red-400 text-sm mt-2">{state.error}</p>
      )}
      {state.created !== undefined && (
        <div className="mt-2 text-sm">
          <p className={state.success ? "text-emerald-400" : "text-amber-400"}>
            {state.created} requisito(s) cargado(s)
            {!state.success && " con errores de validación"}.
          </p>
          {state.errors && state.errors.length > 0 && (
            <ul className="mt-1 space-y-1 text-xs text-red-300 list-disc list-inside max-h-32 overflow-y-auto">
              {state.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
