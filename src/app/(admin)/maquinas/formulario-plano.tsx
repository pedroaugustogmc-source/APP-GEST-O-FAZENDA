"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { enfileirarOperacao } from "@/infra/offline/fila";
import { parseReaisParaCentavos } from "@/lib/dinheiro";

interface FormularioPlanoManutencaoProps {
  maquinas: Array<{ id: string; nome: string }>;
}

// docs/03-modulos.md M7: "ficha de cuidados recomendados pelo fabricante...
// consultável na hora, sem precisar procurar o manual físico perdido no
// galpão" — cada item é uma recorrência (troca de óleo a cada X horas, por
// exemplo), a base do alerta manutencao_vencida/manutencao_proxima.
export function FormularioPlanoManutencao({ maquinas }: FormularioPlanoManutencaoProps) {
  const router = useRouter();
  const [maquinaId, setMaquinaId] = useState(maquinas[0]?.id ?? "");
  const [item, setItem] = useState("");
  const [intervaloHoras, setIntervaloHoras] = useState("");
  const [intervaloDias, setIntervaloDias] = useState("");
  const [pecaReferencia, setPecaReferencia] = useState("");
  const [custoEstimado, setCustoEstimado] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);

    if (!intervaloHoras && !intervaloDias) {
      setErro("Informe o intervalo em horas ou em dias.");
      return;
    }

    let custoCentavos: bigint | null = null;
    if (custoEstimado.trim()) {
      try {
        custoCentavos = parseReaisParaCentavos(custoEstimado);
      } catch (excecao) {
        setErro(excecao instanceof Error ? excecao.message : "Custo estimado inválido.");
        return;
      }
    }

    setSalvando(true);
    await enfileirarOperacao("plano_manutencao", "POST", {
      maquina_id: maquinaId,
      item,
      intervalo_horas: intervaloHoras ? Number(intervaloHoras) : null,
      intervalo_dias: intervaloDias ? Number(intervaloDias) : null,
      peca_referencia: pecaReferencia || null,
      custo_estimado_centavos: custoCentavos !== null ? custoCentavos.toString() : null,
    });
    setSalvando(false);
    setItem("");
    setIntervaloHoras("");
    setIntervaloDias("");
    setPecaReferencia("");
    setCustoEstimado("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Novo item do plano de manutenção</CardTitle>
        <CardDescription>Ex.: troca de óleo a cada 250 horas, calibração de bicos a cada 90 dias.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="plano-maquina">Máquina</Label>
            <Select id="plano-maquina" value={maquinaId} onChange={(e) => setMaquinaId(e.target.value)}>
              {maquinas.length === 0 && <option value="">Nenhuma máquina cadastrada</option>}
              {maquinas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="plano-item">Item</Label>
            <Input id="plano-item" required placeholder="troca de óleo do motor" value={item} onChange={(e) => setItem(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="plano-horas">Intervalo (horas)</Label>
            <Input id="plano-horas" inputMode="numeric" value={intervaloHoras} onChange={(e) => setIntervaloHoras(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="plano-dias">Intervalo (dias)</Label>
            <Input id="plano-dias" inputMode="numeric" value={intervaloDias} onChange={(e) => setIntervaloDias(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="plano-peca">Peça de referência</Label>
            <Input id="plano-peca" value={pecaReferencia} onChange={(e) => setPecaReferencia(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="plano-custo">Custo estimado (R$, opcional)</Label>
            <Input id="plano-custo" inputMode="decimal" placeholder="0,00" value={custoEstimado} onChange={(e) => setCustoEstimado(e.target.value)} />
          </div>
          {erro && <p className="text-sm text-critico sm:col-span-2 lg:col-span-3">{erro}</p>}
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={salvando || maquinas.length === 0}>
              {salvando ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
