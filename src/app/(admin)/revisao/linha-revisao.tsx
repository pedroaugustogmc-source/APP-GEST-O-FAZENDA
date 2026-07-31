"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MensagemBotRow } from "@/infra/supabase/tipos";

interface LinhaRevisaoProps {
  mensagem: MensagemBotRow;
}

/**
 * A confirmação chama a mesma função SQL gravar_eventos_mensagem_bot que a
 * Edge Function usa — o admin edita o JSON dos eventos se algo estiver
 * errado (não há formulário por tipo de evento nesta fase; é o corte de
 * escopo declarado em ESTADO.md) e confirma. Descartar não grava nada.
 */
export function LinhaRevisao({ mensagem }: LinhaRevisaoProps) {
  const router = useRouter();
  const eventos = (mensagem.payload_extraido as { eventos?: unknown[] } | null)?.eventos ?? [];
  const [textoEventos, setTextoEventos] = useState(() => JSON.stringify(eventos, null, 2));
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(acao: "confirmar" | "descartar") {
    setErro(null);
    setEnviando(true);
    try {
      let corpo: Record<string, unknown> = { acao };
      if (acao === "confirmar") {
        const eventosEditados = JSON.parse(textoEventos);
        corpo = { acao, eventos: eventosEditados };
      }

      const resposta = await fetch(`/api/mensagens-bot/${mensagem.id}/revisar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });

      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => null);
        throw new Error(dados?.erro ?? `Falha (HTTP ${resposta.status})`);
      }

      router.refresh();
    } catch (excecao) {
      setErro(
        excecao instanceof SyntaxError
          ? "O JSON dos eventos ficou inválido depois da edição."
          : excecao instanceof Error
            ? excecao.message
            : "Não consegui completar a ação."
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {new Date(mensagem.recebido_em).toLocaleString("pt-BR")} · {mensagem.telefone_origem}
          </CardTitle>
          <Badge variant={mensagem.status === "erro" ? "critico" : "outline"}>{mensagem.status}</Badge>
        </div>
        <CardDescription>
          {mensagem.confianca_media !== null
            ? `Confiança média: ${(mensagem.confianca_media * 100).toFixed(0)}%`
            : "— sem dado — confiança não calculada"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Transcrição</p>
          <p className="text-sm text-muted-foreground">{mensagem.transcricao ?? "— sem dado —"}</p>
        </div>

        {mensagem.status === "erro" && (
          <p className="text-sm text-critico">Erro do processamento: {mensagem.erro ?? "— sem dado —"}</p>
        )}

        {mensagem.status === "revisao" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">Eventos extraídos (edite antes de confirmar, se precisar)</p>
            <Textarea value={textoEventos} onChange={(evento) => setTextoEventos(evento.target.value)} rows={10} />
          </div>
        )}

        {erro && <p className="text-sm text-critico">{erro}</p>}

        <div className="flex gap-2">
          {mensagem.status === "revisao" && (
            <>
              <Button type="button" onClick={() => enviar("confirmar")} disabled={enviando}>
                {enviando ? "Confirmando..." : "Confirmar e gravar"}
              </Button>
              <Button type="button" variant="outline" onClick={() => enviar("descartar")} disabled={enviando}>
                Descartar
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
