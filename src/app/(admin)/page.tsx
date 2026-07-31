import Link from "next/link";
import { criarClienteServidor } from "@/infra/supabase/server";
import { buscarParametros } from "@/infra/supabase/parametros";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { avaliarLotacao } from "@/domain/calculos/avaliarLotacao";
import { distanciaBreakeven } from "@/domain/calculos/distanciaBreakeven";
import { hojeEmFortaleza, partesDeISODate } from "@/domain/tipos/data";
import { buscarIndicadoresFinanceirosFazenda } from "@/infra/supabase/indicadoresFinanceirosFazenda";
import { buscarPrecosMaisRecentes } from "@/infra/supabase/precoMercado";
import { formatarCentavos } from "@/lib/dinheiro";
import type { Centavos, ISODate } from "@/domain/tipos";

export const dynamic = "force-dynamic";

// docs/03-modulos.md M10 — "uma tela, no celular, que responde em 10
// segundos: como está a fazenda hoje?". Regra de ouro: nenhum número aparece
// sem data e sem origem; custo/@, ponto de equilíbrio, margem e caixa vêm de
// `financeiro` (F4) — continuam "— sem dado —" honesto quando a fazenda
// ainda não tem lançamento suficiente, nunca um número inventado (regra 2).
export default async function PaginaInicial() {
  const supabase = criarClienteServidor();
  const hoje = hojeEmFortaleza();
  const parametros = await buscarParametros(supabase);
  const inicioMes = primeiroDiaDoMes(hoje);

  const [
    { data: lotesData },
    { data: lotacaoData },
    { data: alertasAbertos },
    { data: mensagensRecentes },
    { count: filaRevisaoCount },
    indicadoresFinanceiros,
    precoMaisRecentePorTipo,
    { data: financeiroMesData },
  ] = await Promise.all([
    supabase.from("lotes").select("cabecas_atuais").eq("status", "ativo"),
    supabase.from("mv_lotacao_por_pasto").select("*"),
    supabase
      .from("alertas")
      .select("id, tipo, severidade, titulo, mensagem, gerado_em")
      .is("resolvido_em", null)
      // enum severidade é declarado ('info','atencao','critico') — desc traz
      // critico primeiro.
      .order("severidade", { ascending: false })
      .order("gerado_em", { ascending: false })
      .limit(10),
    supabase.from("mensagens_bot").select("id, transcricao, status, recebido_em").order("recebido_em", { ascending: false }).limit(5),
    supabase.from("mensagens_bot").select("id", { count: "exact", head: true }).in("status", ["revisao", "erro"]),
    buscarIndicadoresFinanceirosFazenda(supabase, parametros),
    buscarPrecosMaisRecentes(supabase),
    supabase.from("financeiro").select("tipo, valor_centavos").is("deletado_em", null).gte("data", inicioMes).lte("data", hoje),
  ]);

  const precoBoi = precoMaisRecentePorTipo.get("arroba_boi") ?? null;
  const distanciaMercado =
    precoBoi && indicadoresFinanceiros.pontoEquilibrio.valor !== null && indicadoresFinanceiros.pontoEquilibrio.valor > 0n
      ? distanciaBreakeven(precoBoi.valorCentavos, indicadoresFinanceiros.pontoEquilibrio.valor)
      : null;

  let caixaMes: Centavos = 0n;
  for (const linha of (financeiroMesData ?? []) as Array<{ tipo: "custo" | "receita"; valor_centavos: number }>) {
    caixaMes += linha.tipo === "receita" ? BigInt(linha.valor_centavos) : -BigInt(linha.valor_centavos);
  }
  const temLancamentoNoMes = (financeiroMesData ?? []).length > 0;

  const cabecasTotais = ((lotesData ?? []) as Array<{ cabecas_atuais: number }>).reduce((t, l) => t + l.cabecas_atuais, 0);

  type LinhaLotacao = {
    pasto_id: string;
    tamanho_ha: number;
    capim: string | null;
    tem_acude: boolean;
    nivel_acude: number | null;
    lote_id: string | null;
    cabecas_atuais: number | null;
    peso_medio_kg: number | null;
  };
  const linhasLotacao = (lotacaoData ?? []) as LinhaLotacao[];

  const pastosSuperlotados = linhasLotacao.filter((l) => {
    if (!l.lote_id || l.peso_medio_kg === null || !l.cabecas_atuais) return false;
    return avaliarLotacao(l.peso_medio_kg * l.cabecas_atuais, l.tamanho_ha, l.capim ?? "", l.peso_medio_kg, parametros).excede;
  }).length;

  const acudesBaixos = linhasLotacao.filter(
    (l) => l.tem_acude && l.nivel_acude !== null && l.nivel_acude < (parametros.NIVEL_ACUDE_CRITICO ?? 30)
  ).length;

  const alertas = (alertasAbertos ?? []) as Array<{
    id: string;
    tipo: string;
    severidade: "info" | "atencao" | "critico";
    titulo: string;
    mensagem: string;
    gerado_em: string;
  }>;
  const alertasCriticos = alertas.filter((a) => a.severidade === "critico");
  const vacinaJanela = alertas.filter((a) => a.tipo === "vacina_janela_abrindo").length;
  const vacinaAtrasada = alertas.filter((a) => a.tipo === "vacina_atrasada").length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Como está a fazenda hoje?</h1>
        <p className="text-sm text-muted-foreground">{new Date().toLocaleString("pt-BR")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <NumeroGrande
          titulo="Custo por @"
          valor={indicadoresFinanceiros.custoPorArroba.valor !== null ? `${formatarCentavos(indicadoresFinanceiros.custoPorArroba.valor)}/@` : "— sem dado —"}
          nota={indicadoresFinanceiros.custoPorArroba.motivo ?? `atualizado ${hoje}`}
        />
        <NumeroGrande
          titulo="Ponto de equilíbrio vs mercado"
          valor={distanciaMercado !== null ? `${distanciaMercado >= 0 ? "+" : ""}${(distanciaMercado * 100).toFixed(1)}%` : "— sem dado —"}
          nota={
            distanciaMercado !== null
              ? `PE ${formatarCentavos(indicadoresFinanceiros.pontoEquilibrio.valor)}/@ · mercado ${formatarCentavos(precoBoi!.valorCentavos)}/@`
              : indicadoresFinanceiros.pontoEquilibrio.valor !== null
                ? "sem preço de mercado da arroba do boi para comparar"
                : (indicadoresFinanceiros.pontoEquilibrio.motivo ?? "sem dado")
          }
          inverso={distanciaMercado !== null && distanciaMercado < 0}
        />
        <NumeroGrande
          titulo="Margem projetada"
          valor={indicadoresFinanceiros.margemProjetada !== null ? formatarCentavos(indicadoresFinanceiros.margemProjetada) : "— sem dado —"}
          nota={indicadoresFinanceiros.margemProjetada !== null ? `sobre ${indicadoresFinanceiros.arrobasTotal.toFixed(1)} arroba(s) hoje` : "sem preço de mercado para nenhuma categoria de lote"}
          inverso={indicadoresFinanceiros.margemProjetada !== null && indicadoresFinanceiros.margemProjetada < 0n}
        />
        <NumeroGrande titulo="Cabeças totais" valor={cabecasTotais.toLocaleString("pt-BR")} nota={`atualizado ${hoje}`} destaque />
        <NumeroGrande
          titulo="Caixa do mês"
          valor={temLancamentoNoMes ? formatarCentavos(caixaMes) : "— sem dado —"}
          nota={temLancamentoNoMes ? `receita − custo desde ${inicioMes}` : "nenhum lançamento neste mês"}
          inverso={temLancamentoNoMes && caixaMes < 0n}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pendências operacionais</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <LinhaPendencia label="Pastos acima da lotação" valor={pastosSuperlotados} href="/pastos" critico={pastosSuperlotados > 0} />
            <LinhaPendencia label="Açudes em nível baixo" valor={acudesBaixos} href="/pastos" critico={acudesBaixos > 0} />
            <LinhaPendencia label="Vacinas na janela" valor={vacinaJanela} href="/sanidade" />
            <LinhaPendencia label="Vacinas atrasadas" valor={vacinaAtrasada} href="/sanidade" critico={vacinaAtrasada > 0} />
            <LinhaPendencia label="Manutenção de máquina estourada" valor="— sem dado —" href="/maquinas" nota="Fase 5" />
            <LinhaPendencia label="Fila de revisão do bot" valor={filaRevisaoCount ?? 0} href="/revisao" critico={(filaRevisaoCount ?? 0) > 0} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertas críticos abertos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {alertasCriticos.length === 0 && <p className="text-muted-foreground">Nenhum alerta crítico aberto agora.</p>}
            {alertasCriticos.map((alerta) => (
              <div key={alerta.id} className="border-l-2 border-critico pl-3">
                <p className="font-medium text-foreground">{alerta.titulo}</p>
                <p className="text-muted-foreground">{alerta.mensagem}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarefas prioritárias da semana</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          — sem dado — priorização automática depende de M8 (Fase 5).
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas mensagens do bot</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {((mensagensRecentes ?? []) as Array<{ id: string; transcricao: string | null; status: string; recebido_em: string }>).map(
            (mensagem) => (
              <div key={mensagem.id} className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
                <span className="truncate text-foreground">{mensagem.transcricao ?? "— sem dado —"}</span>
                <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  <Badge variant={mensagem.status === "gravada" ? "default" : "outline"}>{mensagem.status}</Badge>
                  <span>{new Date(mensagem.recebido_em).toLocaleTimeString("pt-BR")}</span>
                </div>
              </div>
            )
          )}
          {(!mensagensRecentes || mensagensRecentes.length === 0) && (
            <p className="text-muted-foreground">Nenhuma mensagem recebida ainda.</p>
          )}
          <Link href="/revisao" className="text-sm font-medium text-primary hover:underline">
            Ver fila de revisão →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function NumeroGrande({
  titulo,
  valor,
  nota,
  destaque,
  inverso,
}: {
  titulo: string;
  valor: string;
  nota: string;
  destaque?: boolean;
  inverso?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-numero-grande ${destaque ? "text-primary" : inverso ? "text-critico" : "text-foreground"}`}>{valor}</p>
        <p className="text-xs text-muted-foreground">{nota}</p>
      </CardContent>
    </Card>
  );
}

function primeiroDiaDoMes(hoje: ISODate): ISODate {
  const partes = partesDeISODate(hoje);
  return `${partes.ano}-${String(partes.mes).padStart(2, "0")}-01`;
}

function LinhaPendencia({
  label,
  valor,
  href,
  critico,
  nota,
}: {
  label: string;
  valor: number | string;
  href: string;
  critico?: boolean;
  nota?: string;
}) {
  return (
    <Link href={href} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
      <span className="text-foreground">
        {label}
        {nota && <span className="text-muted-foreground"> ({nota})</span>}
      </span>
      <span className={critico ? "font-semibold text-critico" : "font-medium text-foreground"}>{valor}</span>
    </Link>
  );
}
