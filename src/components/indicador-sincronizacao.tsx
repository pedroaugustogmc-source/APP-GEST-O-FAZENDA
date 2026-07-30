"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { bancoOffline } from "@/infra/offline/db";

/**
 * "X registros aguardando sincronizar" — indicador permanente exigido pelo
 * §36 item 6. Some quando a fila esvazia; nunca inventa número.
 */
export function IndicadorSincronizacao() {
  const pendentes = useLiveQuery(() => bancoOffline.operacoesPendentes.count(), [], 0);

  if (!pendentes) return null;

  return (
    <div className="rounded-md bg-secondary px-3 py-1 text-sm text-secondary-foreground" role="status">
      {pendentes} {pendentes === 1 ? "registro aguardando" : "registros aguardando"} sincronizar
    </div>
  );
}
