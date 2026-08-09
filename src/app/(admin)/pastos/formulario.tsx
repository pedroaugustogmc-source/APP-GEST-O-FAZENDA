"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enfileirarOperacao, gerarClientUuid } from "@/infra/offline/fila";
import { sincronizar } from "@/infra/offline/sincronizar";
import { enviarFotoPasto } from "@/infra/supabase/fotoPasto";

export function FormularioPasto({ propriedadeId }: { propriedadeId: string }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [apelidos, setApelidos] = useState("");
  const [tamanhoHa, setTamanhoHa] = useState("");
  const [capim, setCapim] = useState("");
  const [temAcude, setTemAcude] = useState(false);
  const [nivelAcude, setNivelAcude] = useState("");
  const [observacao, setObservacao] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [avisoFoto, setAvisoFoto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function selecionarFoto(evento: ChangeEvent<HTMLInputElement>) {
    setFoto(evento.target.files?.[0] ?? null);
    setAvisoFoto(null);
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    setAvisoFoto(null);

    const dadosBase = {
      nome,
      apelidos: apelidos
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      tamanho_ha: Number(tamanhoHa.replace(",", ".")),
      capim: capim || null,
      tem_acude: temAcude,
      nivel_acude: temAcude && nivelAcude ? Number(nivelAcude) : null,
      observacao: observacao || null,
    };

    // O cadastro entra na fila na hora, sem esperar o upload da foto —
    // regra 8 do CLAUDE.md, nunca bloquear a UI por falta de rede (achado
    // em revisão de código: antes, um upload lento numa conexão rural fraca
    // travava o cadastro inteiro, não só a foto). client_uuid fixo aqui
    // porque, se a foto subir, mando um 2º POST com o mesmo valor — POST é
    // upsert por client_uuid (criarRotaEntidade.ts) — que atualiza a MESMA
    // linha sem precisar do id que o servidor ainda não gerou.
    const clientUuid = gerarClientUuid();

    await enfileirarOperacao("pastos", "POST", { ...dadosBase, foto_path: null }, clientUuid);

    if (foto) {
      const resultado = await enviarFotoPasto(propriedadeId, foto);
      if (resultado.erro) {
        setAvisoFoto(`${resultado.erro} O pasto foi salvo sem a foto.`);
      } else if (resultado.caminho) {
        await enfileirarOperacao("pastos", "POST", { ...dadosBase, foto_path: resultado.caminho }, clientUuid);
      }
    }

    // enfileirarOperacao só grava no IndexedDB local e dispara a
    // sincronização em segundo plano (void sincronizar(), fila.ts) — sem
    // esperar ela terminar aqui, o router.refresh() abaixo recarrega a
    // página ANTES do POST chegar no servidor, e o pasto novo (ou a foto)
    // parece não ter sido salvo. Esperar de verdade corrige isso.
    await sincronizar();

    setSalvando(false);
    setNome("");
    setApelidos("");
    setTamanhoHa("");
    setCapim("");
    setTemAcude(false);
    setNivelAcude("");
    setObservacao("");
    setFoto(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo pasto</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="apelidos">Apelidos (separados por vírgula)</Label>
            <Input
              id="apelidos"
              placeholder="pasto do buriti, buritizinho"
              value={apelidos}
              onChange={(e) => setApelidos(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tamanho">Tamanho (ha)</Label>
            <Input
              id="tamanho"
              inputMode="decimal"
              required
              value={tamanhoHa}
              onChange={(e) => setTamanhoHa(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="capim">Capim</Label>
            <Input
              id="capim"
              placeholder="ex.: Marandu, Mombaça, Massai"
              value={capim}
              onChange={(e) => setCapim(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="acude"
              type="checkbox"
              className="h-5 w-5"
              checked={temAcude}
              onChange={(e) => setTemAcude(e.target.checked)}
            />
            <Label htmlFor="acude">Tem açude</Label>
          </div>
          {temAcude && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="nivel">Nível do açude (%)</Label>
              <Input
                id="nivel"
                inputMode="numeric"
                value={nivelAcude}
                onChange={(e) => setNivelAcude(e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="observacao">Observação</Label>
            <Input id="observacao" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="foto">Foto do pasto</Label>
            <input
              id="foto"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={selecionarFoto}
              className="text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium"
            />
            {avisoFoto && <p className="text-xs text-critico">{avisoFoto}</p>}
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={salvando}>
              {salvando ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
