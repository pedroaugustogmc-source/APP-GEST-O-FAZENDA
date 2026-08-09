"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { enfileirarOperacao } from "@/infra/offline/fila";
import { enviarFotoPasto, removerFotoPasto } from "@/infra/supabase/fotoPasto";

interface FotoPastoProps {
  pastoId: string;
  propriedadeId: string;
  fotoPathAtual: string | null;
  fotoUrl: string | null;
}

/** Foto de pasto (pedido do dono) — adicionar na criação já é coberto por
 * formulario.tsx; este componente cobre trocar/adicionar depois, direto no
 * card, pros pastos que já existem. */
export function FotoPasto({ pastoId, propriedadeId, fotoPathAtual, fotoUrl }: FotoPastoProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function trocarFoto(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;

    setEnviando(true);
    setErro(null);

    const resultado = await enviarFotoPasto(propriedadeId, arquivo);
    if (resultado.erro || !resultado.caminho) {
      setErro(resultado.erro ?? "Não deu pra enviar a foto.");
      setEnviando(false);
      return;
    }

    await enfileirarOperacao("pastos", "PATCH", { id: pastoId, foto_path: resultado.caminho });
    if (fotoPathAtual) void removerFotoPasto(fotoPathAtual);

    setEnviando(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada trocada a cada carregamento (expira em 1h), Image do Next exigiria domínio fixo pré-configurado.
        <img src={fotoUrl} alt="Foto do pasto" className="h-40 w-full rounded-md object-cover" />
      ) : (
        <p className="text-xs text-muted-foreground">— sem foto —</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={trocarFoto}
        className="hidden"
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={enviando}
        onClick={() => inputRef.current?.click()}
        className="w-fit"
      >
        {enviando ? "Enviando..." : fotoUrl ? "Trocar foto" : "Adicionar foto"}
      </Button>
      {erro && <span className="text-xs text-critico">{erro}</span>}
    </div>
  );
}
