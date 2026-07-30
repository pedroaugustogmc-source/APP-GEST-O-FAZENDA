"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { analisarCsv, type CsvAnalisado } from "@/infra/importador/csv";
import {
  mapearLinhasParaAnimais,
  type AnimalParaImportar,
  type LinhaRejeitada,
  type MapeamentoColunasAnimais,
} from "@/domain/validacao/importadorAnimais";

type Etapa = "enviar" | "mapear" | "revisar" | "concluido";

const CAMPO_VAZIO = "";

interface ImportadorClienteProps {
  pesoNascimentoMaxKg: number;
}

export function ImportadorCliente({ pesoNascimentoMaxKg }: ImportadorClienteProps) {
  const [etapa, setEtapa] = useState<Etapa>("enviar");
  const [csv, setCsv] = useState<CsvAnalisado | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);

  const [colBrinco, setColBrinco] = useState(CAMPO_VAZIO);
  const [colSexo, setColSexo] = useState(CAMPO_VAZIO);
  const [colCategoria, setColCategoria] = useState(CAMPO_VAZIO);
  const [colNascimento, setColNascimento] = useState(CAMPO_VAZIO);
  const [colPeso, setColPeso] = useState(CAMPO_VAZIO);
  const [colOrigem, setColOrigem] = useState(CAMPO_VAZIO);

  const [validas, setValidas] = useState<AnimalParaImportar[]>([]);
  const [rejeitadas, setRejeitadas] = useState<LinhaRejeitada[]>([]);

  const [gravando, setGravando] = useState(false);
  const [erroGravacao, setErroGravacao] = useState<string | null>(null);
  const [totalGravado, setTotalGravado] = useState(0);

  async function lerArquivo(evento: React.ChangeEvent<HTMLInputElement>) {
    setErroArquivo(null);
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    if (!arquivo.name.toLowerCase().endsWith(".csv")) {
      setErroArquivo("Só arquivo .csv por enquanto. Se sua planilha é .xlsx, exporte como CSV primeiro.");
      return;
    }

    const conteudo = await arquivo.text();
    const analisado = analisarCsv(conteudo);

    if (analisado.linhas.length === 0) {
      setErroArquivo("Não encontrei nenhuma linha de dado nesse arquivo.");
      return;
    }

    setCsv(analisado);
    setNomeArquivo(arquivo.name);
    setEtapa("mapear");
  }

  function analisarMapeamento() {
    if (!csv) return;
    if (!colSexo || !colCategoria) return;

    const mapeamento: MapeamentoColunasAnimais = {
      sexo: colSexo,
      categoria: colCategoria,
      brinco: colBrinco || undefined,
      data_nascimento: colNascimento || undefined,
      peso_nascimento: colPeso || undefined,
      origem: colOrigem || undefined,
    };

    const hoje = new Date().toISOString().slice(0, 10);
    const resultado = mapearLinhasParaAnimais(csv.linhas, mapeamento, hoje, pesoNascimentoMaxKg);
    setValidas(resultado.validas);
    setRejeitadas(resultado.rejeitadas);
    setEtapa("revisar");
  }

  function baixarRelatorioRejeicao() {
    const cabecalho = "linha,motivo\n";
    const corpo = rejeitadas
      .map((linha) => `${linha.numeroLinha},"${linha.motivo.replace(/"/g, '""')}"`)
      .join("\n");
    const blob = new Blob([cabecalho + corpo], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "relatorio-rejeicao.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function confirmarImportacao() {
    setGravando(true);
    setErroGravacao(null);

    try {
      const resposta = await fetch("/api/importar-animais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animais: validas }),
      });

      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        throw new Error(corpo?.erro ?? `Falha ao gravar (HTTP ${resposta.status})`);
      }

      const corpo = (await resposta.json()) as { gravados: number };
      setTotalGravado(corpo.gravados);
      setEtapa("concluido");
    } catch (excecao) {
      setErroGravacao(
        excecao instanceof Error
          ? excecao.message
          : "Não consegui gravar. Confira sua conexão e tente de novo."
      );
    } finally {
      setGravando(false);
    }
  }

  function recomecar() {
    setEtapa("enviar");
    setCsv(null);
    setValidas([]);
    setRejeitadas([]);
    setErroGravacao(null);
    setTotalGravado(0);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Importar planilha</h1>
        <p className="text-sm text-muted-foreground">
          Sobe o CSV do rebanho, você confere linha por linha antes de qualquer coisa ir para o banco.
          Nenhuma linha é corrigida por adivinhação — a que não bater, entra no relatório de rejeição.
        </p>
      </div>

      {etapa === "enviar" && (
        <Card>
          <CardHeader>
            <CardTitle>1. Escolher o arquivo</CardTitle>
            <CardDescription>Formato .csv, com cabeçalho na primeira linha.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Input type="file" accept=".csv,text/csv" onChange={lerArquivo} />
            {erroArquivo && <p className="text-sm text-critico">{erroArquivo}</p>}
          </CardContent>
        </Card>
      )}

      {etapa === "mapear" && csv && (
        <Card>
          <CardHeader>
            <CardTitle>2. Dizer o que é cada coluna</CardTitle>
            <CardDescription>
              Arquivo: {nomeArquivo} · {csv.linhas.length} linha{csv.linhas.length === 1 ? "" : "s"}{" "}
              encontrada{csv.linhas.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <SeletorColuna label="Sexo (obrigatório)" colunas={csv.colunas} valor={colSexo} onChange={setColSexo} />
            <SeletorColuna
              label="Categoria (obrigatório)"
              colunas={csv.colunas}
              valor={colCategoria}
              onChange={setColCategoria}
            />
            <SeletorColuna label="Brinco" colunas={csv.colunas} valor={colBrinco} onChange={setColBrinco} />
            <SeletorColuna
              label="Data de nascimento"
              colunas={csv.colunas}
              valor={colNascimento}
              onChange={setColNascimento}
            />
            <SeletorColuna label="Peso ao nascer" colunas={csv.colunas} valor={colPeso} onChange={setColPeso} />
            <SeletorColuna
              label="Origem (nascimento/compra, se a planilha tiver)"
              colunas={csv.colunas}
              valor={colOrigem}
              onChange={setColOrigem}
            />
            <div className="sm:col-span-2">
              <Button type="button" onClick={analisarMapeamento} disabled={!colSexo || !colCategoria}>
                Analisar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {etapa === "revisar" && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>3. Conferir antes de gravar</CardTitle>
              <CardDescription>
                <Badge variant="default">{validas.length} prontas para gravar</Badge>{" "}
                <Badge variant={rejeitadas.length > 0 ? "critico" : "outline"}>
                  {rejeitadas.length} rejeitadas
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {rejeitadas.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-critico">Linhas rejeitadas — nada foi descartado sem avisar</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Linha</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rejeitadas.map((linha) => (
                        <TableRow key={linha.numeroLinha}>
                          <TableCell>{linha.numeroLinha}</TableCell>
                          <TableCell className="text-critico">{linha.motivo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div>
                    <Button type="button" variant="outline" size="sm" onClick={baixarRelatorioRejeicao}>
                      Baixar relatório de rejeição
                    </Button>
                  </div>
                </div>
              )}

              {validas.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-foreground">Prévia do que vai ser gravado</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Brinco</TableHead>
                        <TableHead>Sexo</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Nascimento</TableHead>
                        <TableHead>Origem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validas.slice(0, 20).map((animal, indice) => (
                        <TableRow key={indice}>
                          <TableCell>{animal.brinco ?? "— sem dado —"}</TableCell>
                          <TableCell>{animal.sexo}</TableCell>
                          <TableCell>{animal.categoria}</TableCell>
                          <TableCell>{animal.data_nascimento ?? "— sem dado —"}</TableCell>
                          <TableCell>{animal.origem}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {validas.length > 20 && (
                    <p className="text-xs text-muted-foreground">
                      Mostrando 20 de {validas.length}. Todas vão ser gravadas ao confirmar.
                    </p>
                  )}
                </div>
              )}

              {erroGravacao && <p className="text-sm text-critico">{erroGravacao}</p>}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={recomecar}>
                  Recomeçar
                </Button>
                <Button type="button" onClick={confirmarImportacao} disabled={validas.length === 0 || gravando}>
                  {gravando ? "Gravando..." : `Confirmar e gravar ${validas.length}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {etapa === "concluido" && (
        <Card>
          <CardHeader>
            <CardTitle>Pronto</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-foreground">
              {totalGravado} animal{totalGravado === 1 ? "" : "is"} gravado{totalGravado === 1 ? "" : "s"}.
              {rejeitadas.length > 0 &&
                ` ${rejeitadas.length} linha${rejeitadas.length === 1 ? "" : "s"} ficaram de fora — baixe o relatório se ainda não baixou.`}
            </p>
            <div>
              <Button type="button" onClick={recomecar}>
                Importar outra planilha
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface SeletorColunaProps {
  label: string;
  colunas: string[];
  valor: string;
  onChange: (valor: string) => void;
}

function SeletorColuna({ label, colunas, valor, onChange }: SeletorColunaProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Select value={valor} onChange={(evento) => onChange(evento.target.value)}>
        <option value="">— não tem essa coluna —</option>
        {colunas.map((coluna) => (
          <option key={coluna} value={coluna}>
            {coluna}
          </option>
        ))}
      </Select>
    </div>
  );
}
