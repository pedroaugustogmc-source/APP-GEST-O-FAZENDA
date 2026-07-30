"use client";

import { useEffect } from "react";
import { registrarSincronizacaoAutomatica } from "@/infra/offline/sincronizar";

/**
 * Registra o service worker (instalabilidade + cache do shell) e liga o
 * laço de sincronização da fila offline (docs/05-arquitetura.md §36).
 * Fica no layout raiz porque vale tanto para as telas logadas quanto para
 * o /login (a PWA precisa abrir mesmo sem sinal).
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Falha ao registrar o SW não deve travar o app — a fila offline via
        // IndexedDB continua funcionando mesmo sem o cache de shell.
      });
    }
    registrarSincronizacaoAutomatica();
  }, []);

  return null;
}
