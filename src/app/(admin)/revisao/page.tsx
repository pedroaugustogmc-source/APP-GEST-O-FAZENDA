import { criarClienteServidor } from "@/infra/supabase/server";
import type { MensagemBotRow } from "@/infra/supabase/tipos";
import { LinhaRevisao } from "./linha-revisao";

export const dynamic = "force-dynamic";

export default async function PaginaRevisao() {
  const supabase = criarClienteServidor();
  const { data } = await supabase
    .from("mensagens_bot")
    .select("*")
    .in("status", ["revisao", "erro"])
    .order("recebido_em", { ascending: false })
    .limit(100);

  const mensagens = (data ?? []) as MensagemBotRow[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Fila de revisão</h1>
        <p className="text-sm text-muted-foreground">
          Mensagens do bot com confiança baixa, sem nada gravado ou com falha de processamento. Confira o que o
          bot entendeu antes de confirmar — nada é gravado sem essa conferência.
        </p>
      </div>

      {mensagens.length === 0 && (
        <p className="text-sm text-muted-foreground">— sem dado — nenhuma mensagem pendente de revisão.</p>
      )}

      <div className="flex flex-col gap-4">
        {mensagens.map((mensagem) => (
          <LinhaRevisao key={mensagem.id} mensagem={mensagem} />
        ))}
      </div>
    </div>
  );
}
