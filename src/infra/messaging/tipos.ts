// docs/05-arquitetura.md §34: "Bot: Telegram Bot API na Fase 2, atrás de uma
// interface MessagingAdapter (receber, responder, baixarMidia) para trocar
// por WhatsApp Business API na Fase 6 sem tocar na lógica de domínio."
//
// `pedirContato` existe porque nenhuma plataforma de bot entrega o telefone
// do remetente de graça — o Telegram só revela `contact.phone_number` depois
// que o próprio usuário aperta um botão de "compartilhar contato". É assim
// que o porteiro (docs/03-modulos.md §M1 passo 1) liga um `chat_id_externo`
// ao `usuarios_acesso.telefone` já cadastrado pelo admin, sem custo de API.

export type Plataforma = "telegram" | "whatsapp";
export type TipoMensagem = "audio" | "texto" | "foto" | "documento";

export interface MensagemRecebida {
  chatIdExterno: string;
  plataforma: Plataforma;
  tipo: TipoMensagem;
  texto: string | null;
  fileId: string | null;
  duracaoSegundos: number | null;
  /** Preenchido só quando a mensagem é o próprio compartilhamento de contato. */
  telefoneCompartilhado: string | null;
}

export interface MidiaBaixada {
  bytes: Uint8Array;
  mimeType: string;
}

export interface MessagingAdapter {
  /** Interpreta o payload cru do webhook. Retorna null se não for uma mensagem reconhecível. */
  receber(payloadWebhook: unknown): MensagemRecebida | null;
  responder(chatIdExterno: string, texto: string): Promise<void>;
  /** Pede ao usuário para compartilhar o contato (telefone), para o porteiro conseguir ligar chat_id ↔ usuarios_acesso. */
  pedirContato(chatIdExterno: string, texto: string): Promise<void>;
  baixarMidia(fileId: string): Promise<MidiaBaixada>;
}
