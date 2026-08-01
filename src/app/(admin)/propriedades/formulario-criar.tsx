"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Decisão do dono (ESTADO.md, Fase 6b): sem troca de fazenda em sessão —
// cada fazenda usa um login (e-mail) próprio. Quem cria aqui digita a senha
// do primeiro admin da fazenda nova, e precisa repassar e-mail+senha pra
// essa pessoa por fora do sistema (mesmo fluxo manual que já existia via
// Supabase Studio, só que pelo app).
export function FormularioCriarPropriedade() {
  const [nome, setNome] = useState("");
  const [municipio, setMunicipio] = useState("Imperatriz");
  const [uf, setUf] = useState("MA");
  const [areaTotalHa, setAreaTotalHa] = useState("");
  const [adminNome, setAdminNome] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminTelefone, setAdminTelefone] = useState("");
  const [adminSenha, setAdminSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function criar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSucesso(null);
    setEnviando(true);
    try {
      const resposta = await fetch("/api/propriedades/criar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          propriedade: {
            nome,
            municipio,
            uf,
            area_total_ha: areaTotalHa.trim() ? Number(areaTotalHa) : null,
          },
          admin: { nome: adminNome, email: adminEmail, telefone: adminTelefone, senha: adminSenha },
        }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(corpo?.erro ?? `Falha (HTTP ${resposta.status})`);

      setSucesso(
        `Fazenda "${nome}" criada. Repasse o login pro admin dela: e-mail ${corpo.adminEmail}, a senha que você acabou de digitar.`
      );
      setNome("");
      setMunicipio("Imperatriz");
      setUf("MA");
      setAreaTotalHa("");
      setAdminNome("");
      setAdminEmail("");
      setAdminTelefone("");
      setAdminSenha("");
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : "Não consegui criar a fazenda.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={criar} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="nova-fazenda-nome">Nome da fazenda</Label>
          <Input id="nova-fazenda-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nova-fazenda-municipio">Município</Label>
          <Input id="nova-fazenda-municipio" required value={municipio} onChange={(e) => setMunicipio(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nova-fazenda-uf">UF</Label>
          <Input id="nova-fazenda-uf" required maxLength={2} value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nova-fazenda-area">Área total (ha)</Label>
          <Input id="nova-fazenda-area" inputMode="decimal" value={areaTotalHa} onChange={(e) => setAreaTotalHa(e.target.value)} />
        </div>
      </div>

      <p className="text-sm font-medium text-foreground">Primeiro admin desta fazenda</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="novo-admin-nome">Nome</Label>
          <Input id="novo-admin-nome" required value={adminNome} onChange={(e) => setAdminNome(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="novo-admin-email">E-mail (login)</Label>
          <Input id="novo-admin-email" type="email" required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="novo-admin-telefone">Telefone (com DDD e +55)</Label>
          <Input
            id="novo-admin-telefone"
            placeholder="+5599999999999"
            required
            value={adminTelefone}
            onChange={(e) => setAdminTelefone(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="novo-admin-senha">Senha temporária (mín. 8 caracteres)</Label>
          <Input
            id="novo-admin-senha"
            type="password"
            minLength={8}
            required
            value={adminSenha}
            onChange={(e) => setAdminSenha(e.target.value)}
          />
        </div>
      </div>

      {erro && <p className="text-sm text-critico">{erro}</p>}
      {sucesso && <p className="text-sm text-primary">{sucesso}</p>}

      <div>
        <Button type="submit" disabled={enviando}>
          {enviando ? "Criando..." : "Criar fazenda"}
        </Button>
      </div>
    </form>
  );
}
