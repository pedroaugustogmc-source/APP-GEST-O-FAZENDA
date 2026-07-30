"use client";

import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/infra/supabase/client";
import { Button } from "@/components/ui/button";

export function BotaoSair() {
  const router = useRouter();

  async function sair() {
    const supabase = criarClienteNavegador();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={sair}>
      Sair
    </Button>
  );
}
