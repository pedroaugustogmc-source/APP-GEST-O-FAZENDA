import { criarClienteServidor } from "@/infra/supabase/server";
import { buscarParametros } from "@/infra/supabase/parametros";
import { hojeEmFortaleza } from "@/domain/tipos/data";
import { buscarLotesParaSimulacao } from "./consultas";
import { SimuladorCenarios } from "./simulador";

export const dynamic = "force-dynamic";

// docs/03-modulos.md M5 "Cenários": 3 cenários de preço × seca, gráfico de
// fluxo de caixa de 90 dias. simularCenarios roda no cliente (é função pura,
// sem I/O) — o servidor só entrega os valores sugeridos de partida por lote.
export default async function PaginaCenarios() {
  const supabase = criarClienteServidor();
  const hoje = hojeEmFortaleza();
  const parametros = await buscarParametros(supabase);
  const lotes = await buscarLotesParaSimulacao(supabase, parametros, hoje);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Cenários de venda</h1>
        <p className="text-sm text-muted-foreground">
          Preço do bezerro/garrote em alta, estável ou queda, cruzado com o impacto de uma possível estiagem no GMD
          (que atrasa a data de venda). Cada cenário mostra data provável de venda, arrobas, receita, margem e
          caixa mínimo no período.
        </p>
      </div>

      {lotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum lote de recria ativo — cadastre em Lotes ou aguarde o bot registrar movimentação.
        </p>
      ) : (
        <SimuladorCenarios lotes={lotes} parametros={parametros} />
      )}
    </div>
  );
}
