import type { NextRequest } from "next/server";
import { atualizarSessao } from "@/infra/supabase/middleware";

export async function middleware(request: NextRequest) {
  return atualizarSessao(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|sw.js).*)"],
};
