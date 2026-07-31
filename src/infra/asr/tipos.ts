// Interface de transcrição (ASR) — isolada porque a Claude Messages API não
// aceita áudio bruto como content block (confirmado em platform.claude.com/docs
// antes de desenhar esta fase: só existem os tipos text/image/document). A
// transcrição precisa de um provedor separado; esta interface é o que permite
// trocar de provedor sem tocar no pipeline do bot — mesmo padrão do
// MessagingAdapter em src/infra/messaging/.

export interface ResultadoTranscricao {
  texto: string;
  duracaoSegundos: number | null;
}

export interface AudioParaTranscrever {
  bytes: Uint8Array;
  mimeType: string;
}

export interface Transcritor {
  transcrever(audio: AudioParaTranscrever): Promise<ResultadoTranscricao>;
}
