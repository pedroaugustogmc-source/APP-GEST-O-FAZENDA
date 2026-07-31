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
import type { PlanoManutencaoRow } from "@/infra/supabase/tipos";

interface FormularioManutencaoProps {
  maquinas: Array<{ id: string; nome: string; horasUsoTotal: number }>;
  planos: PlanoManutencaoRow[];
}

// docs/03-modulos.md M7 — registro administrativo de manutenção. O bot já
// grava o evento por voz desde a F2 (data, tipo, horas, custo), mas sem
// "próxima em quantas horas": o vaqueiro não sabe de cabeça o intervalo do
// fabricante. Esta tela existe pra preencher exatamente esse campo, que é
// o que alimenta avaliarManutencao/o semáforo/o alerta preditivo.
export function FormularioManutencao({ maquinas, planos }: FormularioManutencaoProps) {
  const router = useRouter();
  const [maquinaId, setMaquinaId] = useState(maquinas[0]?.id ?? "");
  const [planoId, setPlanoId] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = useState("");
  const [preventiva, setPreventiva] = useState(true);
  const [horasNoMomento, setHorasNoMomento] = useState("");
  const [pecaTrocada, setPecaTrocada] = useState("");
  const [custo, setCusto] = useState("");
  const [executadoPor, setExecutadoPor] = useState("");
  const [proximaEmHoras, setProximaEmHoras] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const planosDaMaquina = planos.filter((p) => p.maquina_id === maquinaId);

  function selecionarPlano(id: string) {
    setPlanoId(id);
    const plano = planos.find((p) => p.id === id);
    const maquina = maquinas.find((m) => m.id === maquinaId);
    if (plano?.intervalo_horas && maquina) {
      const base = horasNoMomento ? Number(horasNoMomento) : maquina.horasUsoTotal;
      setProximaEmHoras(String(base + plano.intervalo_horas));
    }
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);

    let custoCentavos: bigint | null = null;
    if (custo.trim()) {
      try {
        custoCentavos = parseReaisParaCentavos(custo);
      } catch (excecao) {
        setErro(excecao instanceof Error ? excecao.message : "Custo inválido.");
        return;
      }
    }

    setSalvando(true);
    await enfileirarOperacao("manutencoes", "POST", {
      maquina_id: maquinaId,
      plano_id: planoId || null,
      data,
      tipo,
      preventiva,
      horas_no_momento: horasNoMomento ? Number(horasNoMomento) : null,
      peca_trocada: pecaTrocada || null,
      custo_centavos: custoCentavos !== null ? custoCentavos.toString() : null,
      executado_por: executadoPor || null,
      proxima_em_horas: proximaEmHoras ? Number(proximaEmHoras) : null,
    });
    setSalvando(false);
    setTipo("");
    setPecaTrocada("");
    setCusto("");
    setExecutadoPor("");
    setProximaEmHoras("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Registrar manutenção</CardTitle>
        <CardDescription>
          &ldquo;Próxima em (horas)&rdquo; é o que liga o alerta de manutenção vencida/próxima — selecione um item do
          plano pra calcular sozinho, ou preencha na mão.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="manut-maquina">Máquina</Label>
            <Select id="manut-maquina" value={maquinaId} onChange={(e) => { setMaquinaId(e.target.value); setPlanoId(""); }}>
              {maquinas.length === 0 && <option value="">Nenhuma máquina cadastrada</option>}
              {maquinas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="manut-plano">Item do plano (opcional)</Label>
            <Select id="manut-plano" value={planoId} onChange={(e) => selecionarPlano(e.target.value)}>
              <option value="">— nenhum —</option>
              {planosDaMaquina.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.item}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="manut-data">Data</Label>
            <Input id="manut-data" type="date" required value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="manut-tipo">Tipo</Label>
            <Input id="manut-tipo" required placeholder="troca de óleo" value={tipo} onChange={(e) => setTipo(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input id="manut-preventiva" type="checkbox" className="h-5 w-5" checked={preventiva} onChange={(e) => setPreventiva(e.target.checked)} />
            <Label htmlFor="manut-preventiva">Preventiva (não corretiva)</Label>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="manut-horas">Horas no momento</Label>
            <Input id="manut-horas" inputMode="numeric" value={horasNoMomento} onChange={(e) => setHorasNoMomento(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="manut-peca">Peça trocada</Label>
            <Input id="manut-peca" value={pecaTrocada} onChange={(e) => setPecaTrocada(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="manut-custo">Custo (R$)</Label>
            <Input id="manut-custo" inputMode="decimal" placeholder="0,00" value={custo} onChange={(e) => setCusto(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="manut-executado">Executado por</Label>
            <Input id="manut-executado" value={executadoPor} onChange={(e) => setExecutadoPor(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="manut-proxima">Próxima manutenção em (horas)</Label>
            <Input id="manut-proxima" inputMode="numeric" value={proximaEmHoras} onChange={(e) => setProximaEmHoras(e.target.value)} />
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
