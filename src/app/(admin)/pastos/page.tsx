import { criarClienteServidor } from "@/infra/supabase/server";
import { buscarParametros } from "@/infra/supabase/parametros";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SeletorStatus } from "@/components/seletor-status";
import { transicaoValidaPasto, TODOS_STATUS_PASTO, type StatusPasto } from "@/domain/estados/pasto";
import { avaliarLotacao } from "@/domain/calculos/avaliarLotacao";
import { hojeEmFortaleza, partesDeISODate } from "@/domain/tipos/data";
import type { ISODate } from "@/domain/tipos";
import { FormularioPasto } from "./formulario";

export const dynamic = "force-dynamic";

interface LinhaLotacao {
  pasto_id: string;
  pasto_nome: string;
  tamanho_ha: number;
  capim: string | null;
  tem_acude: boolean;
  nivel_acude: number | null;
  nivel_acude_em: string | null;
  pasto_status: StatusPasto;
  data_entrada_lote_atual: ISODate | null;
  data_saida_ultimo_lote: ISODate | null;
  lote_id: string | null;
  lote_nome: string | null;
  lote_categoria: string | null;
  cabecas_atuais: number | null;
  peso_medio_kg: number | null;
  peso_medio_data: ISODate | null;
}

export default async function PaginaPastos() {
  const supabase = criarClienteServidor();
  const hoje = hojeEmFortaleza();

  const [{ data: lotacaoData }, parametros, { data: movimentacoes }, { data: chuvaData }] = await Promise.all([
    supabase.from("v_lotacao_por_pasto").select("*").order("pasto_nome"),
    buscarParametros(supabase),
    supabase
      .from("movimentacoes_pasto")
      .select("pasto_destino_id, dias_descanso_destino")
      .not("dias_descanso_destino", "is", null),
    supabase.from("chuvas").select("milimetros").gte("data", subtrairDias(hoje, 30)),
  ]);

  const pastos = (lotacaoData ?? []) as LinhaLotacao[];
  const chuva30dias = (chuvaData ?? []).reduce((total: number, c: { milimetros: number }) => total + c.milimetros, 0);

  const descansoPorPasto = new Map<string, number[]>();
  for (const mov of (movimentacoes ?? []) as Array<{ pasto_destino_id: string; dias_descanso_destino: number }>) {
    const lista = descansoPorPasto.get(mov.pasto_destino_id) ?? [];
    lista.push(mov.dias_descanso_destino);
    descansoPorPasto.set(mov.pasto_destino_id, lista);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Pastos</h1>
        <p className="text-sm text-muted-foreground">
          Chuva acumulada nos últimos 30 dias na região:{" "}
          <span className="font-medium text-foreground">
            {chuvaData && chuvaData.length > 0 ? `${chuva30dias.toFixed(1)} mm` : "— sem dado —"}
          </span>
        </p>
      </div>
      <FormularioPasto />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pastos.map((pasto) => {
          const historico = descansoPorPasto.get(pasto.pasto_id) ?? [];
          const mediaDescanso = historico.length > 0 ? historico.reduce((t, d) => t + d, 0) / historico.length : null;
          const minDescanso = historico.length > 0 ? Math.min(...historico) : null;

          const diasNoPasto =
            pasto.data_entrada_lote_atual ? diferencaDiasSimples(pasto.data_entrada_lote_atual, hoje) : null;

          const avaliacao =
            pasto.lote_id && pasto.peso_medio_kg !== null && pasto.cabecas_atuais
              ? avaliarLotacao(
                  pasto.peso_medio_kg * pasto.cabecas_atuais,
                  pasto.tamanho_ha,
                  pasto.capim ?? "",
                  pasto.peso_medio_kg,
                  parametros
                )
              : null;

          const acudeCritico =
            pasto.tem_acude && pasto.nivel_acude !== null && pasto.nivel_acude < (parametros.NIVEL_ACUDE_CRITICO ?? 30);

          const corBorda = avaliacao?.excede || acudeCritico ? "border-critico" : "border-border";

          return (
            <Card key={pasto.pasto_id} className={corBorda}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">{pasto.pasto_nome}</CardTitle>
                  {(avaliacao?.excede || acudeCritico) && <Badge variant="critico">atenção</Badge>}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <span>Tamanho</span>
                  <span className="text-right text-foreground">{pasto.tamanho_ha.toLocaleString("pt-BR")} ha</span>
                  <span>Capim</span>
                  <span className="text-right text-foreground">{pasto.capim ?? "— sem dado —"}</span>
                  <span>Açude</span>
                  <span className={`text-right ${acudeCritico ? "font-semibold text-critico" : "text-foreground"}`}>
                    {pasto.tem_acude ? (pasto.nivel_acude !== null ? `${pasto.nivel_acude}%` : "— sem dado —") : "sem açude"}
                  </span>
                </div>

                <div className="border-t border-border pt-3">
                  {pasto.lote_id ? (
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <span>Lote atual</span>
                      <span className="text-right text-foreground">{pasto.lote_nome}</span>
                      <span>Cabeças</span>
                      <span className="text-right text-foreground">{pasto.cabecas_atuais}</span>
                      <span>Peso médio</span>
                      <span className="text-right text-foreground">
                        {pasto.peso_medio_kg !== null ? `${pasto.peso_medio_kg.toLocaleString("pt-BR")} kg` : "— sem dado —"}
                      </span>
                      <span>Dias no pasto</span>
                      <span className="text-right text-foreground">{diasNoPasto ?? "— sem dado —"}</span>
                      {avaliacao && (
                        <>
                          <span>Lotação</span>
                          <span className={`text-right ${avaliacao.excede ? "font-semibold text-critico" : "text-foreground"}`}>
                            {avaliacao.lotacao.toFixed(3)} UA/ha
                          </span>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Nenhum lote neste pasto agora.</p>
                  )}
                </div>

                <div className="border-t border-border pt-3 text-muted-foreground">
                  <span>Descanso entre lotes (média / mínimo): </span>
                  <span className="text-foreground">
                    {mediaDescanso !== null ? `${mediaDescanso.toFixed(0)} / ${minDescanso} dias` : "— sem dado —"}
                  </span>
                </div>

                <SeletorStatus<StatusPasto>
                  id={pasto.pasto_id}
                  tabela="pastos"
                  atual={pasto.pasto_status}
                  opcoes={TODOS_STATUS_PASTO}
                  ehValida={transicaoValidaPasto}
                />
              </CardContent>
            </Card>
          );
        })}
        {pastos.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground">
            Nenhum pasto cadastrado — comece pelo formulário acima.
          </p>
        )}
      </div>
    </div>
  );
}

function subtrairDias(data: ISODate, dias: number): ISODate {
  const partes = partesDeISODate(data);
  const resultado = new Date(Date.UTC(partes.ano, partes.mes - 1, partes.dia - dias));
  const ano = resultado.getUTCFullYear();
  const mes = String(resultado.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(resultado.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function diferencaDiasSimples(a: ISODate, b: ISODate): number {
  const partesA = partesDeISODate(a);
  const partesB = partesDeISODate(b);
  const msA = Date.UTC(partesA.ano, partesA.mes - 1, partesA.dia);
  const msB = Date.UTC(partesB.ano, partesB.mes - 1, partesB.dia);
  return Math.round((msB - msA) / (1000 * 60 * 60 * 24));
}
