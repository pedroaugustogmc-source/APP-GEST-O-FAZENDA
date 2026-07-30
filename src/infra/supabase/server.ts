import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Cliente Supabase para Server Components e Route Handlers — usa a sessão do
 * cookie do admin/gerente logado. RLS decide o que ele pode ler/gravar
 * (docs/02-dados.md §14); esta função não escolhe papel nenhum.
 */
export function criarClienteServidor() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Chamado de um Server Component sem permissão de escrever cookie;
            // o middleware já cuida do refresh de sessão nesse caso.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // idem
          }
        },
      },
    }
  );
}

/**
 * Cliente com service_role — só para uso server-side (route handlers e
 * workers), nunca no cliente (CLAUDE.md §39). Ignora RLS por design: quem
 * chama esta função é responsável por já ter validado a permissão antes.
 */
export function criarClienteServico() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
