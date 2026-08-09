import { criarClienteNavegador } from "./client";

// Limite de engenharia, não parâmetro de negócio da fazenda — mesmo
// raciocínio do CLAUDE.md regra 3 aplicado à migração
// 20260809120000_foto_pastos.sql (bucket "fotos-pastos" tem os mesmos
// valores no lado do Storage).
const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024;
const EXTENSAO_POR_TIPO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface ResultadoUploadFoto {
  caminho: string | null;
  erro: string | null;
}

/**
 * Envia a foto de um pasto pro bucket privado "fotos-pastos". Caminho
 * sempre "{propriedade_id}/{uuid}.{extensão}" — é o que a RLS de
 * storage.objects exige (current_propriedade_id() como primeiro segmento).
 * Upload é uma operação direta (não passa pela fila offline — Storage não
 * tem como ser enfileirado como JSON, docs/05-arquitetura.md §36 é sobre
 * mutação de linha, não bytes de arquivo): se não houver rede, falha aqui e
 * quem chamou decide seguir sem foto, nunca bloqueia o cadastro do pasto.
 */
export async function enviarFotoPasto(propriedadeId: string, arquivo: File): Promise<ResultadoUploadFoto> {
  const extensao = EXTENSAO_POR_TIPO[arquivo.type];
  if (!extensao) {
    return { caminho: null, erro: "Formato não aceito — use JPEG, PNG ou WEBP." };
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return { caminho: null, erro: "Imagem muito grande — máximo 5MB." };
  }

  const identificador =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const caminho = `${propriedadeId}/${identificador}.${extensao}`;

  const supabase = criarClienteNavegador();
  const { error } = await supabase.storage.from("fotos-pastos").upload(caminho, arquivo);

  if (error) {
    // Mostra o motivo real (permissão, rede, etc.) em vez de presumir que é
    // sempre falta de conexão — regra 2 do CLAUDE.md também vale pra
    // mensagem de erro, não só pra dado exibido.
    return { caminho: null, erro: `Não deu pra enviar a foto: ${error.message}` };
  }
  return { caminho, erro: null };
}

/** Best-effort — se a exclusão falhar, o arquivo antigo só fica órfão no bucket, não quebra nada. */
export async function removerFotoPasto(caminho: string): Promise<void> {
  const supabase = criarClienteNavegador();
  await supabase.storage.from("fotos-pastos").remove([caminho]);
}
