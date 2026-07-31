import { criarClienteServidor } from "@/infra/supabase/server";
import { buscarParametros } from "@/infra/supabase/parametros";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatarCentavos } from "@/lib/dinheiro";
import { FormularioMaquina } from "./formulario";
import { FormularioPlanoManutencao } from "./formulario-plano";
import { FormularioManutencao } from "./formulario-manutencao";
import { buscarMaquinasComIndicadores, type MaquinaComIndicadores } from "./consultas";

export const dynamic = "force-dynamic";

// docs/03-modulos.md M7 — sala de máquinas: ficha de cuidados consultável
// na hora, alerta preditivo de manutenção antes de virar quebra cara, e
// custo acumulado + custo/hora por máquina.
export default async function PaginaMaquinas() {
  const supabase = criarClienteServidor();
  const parametros = await buscarParametros(supabase);
  const maquinasComIndicadores = await buscarMaquinasComIndicadores(supabase, parametros);

  const maquinasParaFormulario = maquinasComIndicadores.map((m) => ({ id: m.maquina.id, nome: m.maquina.nome, horasUsoTotal: m.maquina.horas_uso_total }));
  const todosOsPlanos = maquinasComIndicadores.flatMap((m) => m.planos);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Máquinas</h1>

      <FormularioMaquina />
      <FormularioPlanoManutencao maquinas={maquinasParaFormulario} />
      <FormularioManutencao maquinas={maquinasParaFormulario} planos={todosOsPlanos} />

      <div className="grid gap-4 lg:grid-cols-2">
        {maquinasComIndicadores.map((item) => (
          <CartaoMaquina key={item.maquina.id} item={item} />
        ))}
        {maquinasComIndicadores.length === 0 && (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma máquina cadastrada — comece pelo formulário acima.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

const ROTULO_STATUS: Record<MaquinaComIndicadores["statusManutencao"], string> = {
  ok: "em dia",
  proxima: "manutenção próxima",
  vencida: "manutenção vencida",
};

function CartaoMaquina({ item }: { item: MaquinaComIndicadores }) {
  const { maquina } = item;
  const badgeVariant = item.statusManutencao === "vencida" ? "critico" : item.statusManutencao === "proxima" ? "secondary" : "outline";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {maquina.nome} <span className="font-normal text-muted-foreground">· {maquina.tipo}</span>
          </CardTitle>
          <Badge variant={badgeVariant}>{ROTULO_STATUS[item.statusManutencao]}</Badge>
        </div>
        <CardDescription>
          {maquina.fabricante ? `${maquina.fabricante} ${maquina.modelo}` : maquina.modelo}
          {maquina.ano ? ` · ${maquina.ano}` : ""} · Status: {maquina.status}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Indicador titulo="Horas totais" valor={`${maquina.horas_uso_total.toLocaleString("pt-BR")} h`} />
          <Indicador
            titulo="Próxima manutenção"
            valor={item.horasRestantes !== null ? `${item.horasRestantes >= 0 ? "faltam " : "passou "}${Math.abs(item.horasRestantes).toFixed(0)} h` : "— sem dado —"}
            critico={item.statusManutencao !== "ok"}
          />
          <Indicador titulo="Custo acumulado" valor={formatarCentavos(item.custoAcumuladoCentavos)} />
          <Indicador
            titulo="Custo/hora"
            valor={item.custoPorHora.valor !== null ? `${formatarCentavos(item.custoPorHora.valor)}/h` : "— sem dado —"}
          />
        </div>

        {maquina.ficha_cuidados && Object.keys(maquina.ficha_cuidados).length > 0 && (
          <div>
            <p className="font-medium text-foreground">Ficha de cuidados</p>
            <dl className="grid grid-cols-2 gap-1 text-muted-foreground">
              {Object.entries(maquina.ficha_cuidados).map(([chave, valor]) => (
                <div key={chave} className="flex justify-between gap-2 border-b border-border py-0.5">
                  <dt>{chave}</dt>
                  <dd>{valor}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {item.planos.length > 0 && (
          <div>
            <p className="font-medium text-foreground">Plano de manutenção</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {item.planos.map((p) => (
                <li key={p.id}>
                  {p.item} — a cada {p.intervalo_horas ? `${p.intervalo_horas} h` : `${p.intervalo_dias} dia(s)`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {item.historicoManutencoes.length > 0 && (
          <div>
            <p className="font-medium text-foreground">Últimas manutenções</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Custo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.historicoManutencoes.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{new Date(`${m.data}T00:00:00`).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{m.tipo}</TableCell>
                    <TableCell>{m.custo_centavos !== null ? formatarCentavos(BigInt(m.custo_centavos)) : "— sem dado —"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Indicador({ titulo, valor, critico }: { titulo: string; valor: string; critico?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={`font-semibold ${critico ? "text-critico" : "text-foreground"}`}>{valor}</p>
    </div>
  );
}
