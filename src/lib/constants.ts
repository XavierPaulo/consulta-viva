export const ROLES = {
  ADMIN: "Administrador",
  MEDICO: "Médico",
  SECRETARIA: "Secretária / Recepção",
  LEITURA: "Somente leitura",
} as const;
export type Role = keyof typeof ROLES;

export const APPOINTMENT_STATUS = {
  AGENDADA: { label: "Agendada", tone: "blue" },
  CONFIRMADA: { label: "Confirmada", tone: "teal" },
  REALIZADA: { label: "Realizada", tone: "green" },
  CANCELADA: { label: "Cancelada", tone: "gray" },
  FALTOU: { label: "Faltou", tone: "amber" },
} as const;
export type AppointmentStatus = keyof typeof APPOINTMENT_STATUS;

export const APPOINTMENT_TYPES = {
  PRESENCIAL: "Presencial",
  TELECONSULTA: "Teleconsulta",
} as const;

export const PAYMENT_METHODS = {
  PARTICULAR: "Particular",
  CONVENIO: "Convênio",
  CREDITO: "Cartão de crédito",
  DEBITO: "Cartão de débito",
  PIX: "PIX",
  DINHEIRO: "Dinheiro",
  BOLETO: "Boleto",
  PARCELAMENTO: "Parcelamento",
} as const;

// Formas usadas ao registrar um pagamento (o que efetivamente entrou no caixa)
export const PAYMENT_ENTRY_METHODS = {
  PIX: "PIX",
  CREDITO: "Cartão de crédito",
  DEBITO: "Cartão de débito",
  DINHEIRO: "Dinheiro",
  BOLETO: "Boleto",
  CONVENIO: "Convênio",
  LINK: "Link de pagamento",
} as const;

export const PAYMENT_STATUS = {
  PENDENTE: { label: "Pendente", tone: "amber" },
  PAGO: { label: "Pago", tone: "green" },
  ESTORNADO: { label: "Estornado", tone: "gray" },
  CANCELADO: { label: "Cancelado", tone: "gray" },
} as const;

export const MESSAGE_STATUS = {
  NOVA: { label: "Nova", tone: "blue" },
  LIDA: { label: "Lida", tone: "gray" },
  RESPONDIDA: { label: "Respondida", tone: "green" },
  ARQUIVADA: { label: "Arquivada", tone: "gray" },
} as const;

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const SHIFTS = {
  MANHA: { label: "Manhã", from: 0, to: 12 },
  TARDE: { label: "Tarde", from: 12, to: 18 },
  NOITE: { label: "Noite", from: 18, to: 24 },
} as const;
export type Shift = keyof typeof SHIFTS;

// Seções da página pública. required = obrigatória (*), sempre visível.
// As opcionais podem ser ocultadas por checkbox e somem sozinhas quando não têm conteúdo.
export const PUBLIC_SECTIONS = [
  { key: "identidade", label: "Página inicial com identidade visual", required: true },
  { key: "profissionais", label: "Profissionais (fotos, CRM, especialidade, formação, experiência)", required: true },
  { key: "especialidades", label: "Lista de especializações", required: true },
  { key: "convenios", label: "Convênios aceitos", required: false },
  { key: "mensagem", label: "Comunicação direta (mensagem para o médico)", required: false },
  { key: "pagamento", label: "Formas de pagamento aceitas", required: true },
  { key: "agenda", label: "Horário de funcionamento e agenda", required: true },
  { key: "depoimentos", label: "Depoimentos de pacientes", required: false },
  { key: "faq", label: "Perguntas frequentes (FAQ)", required: false },
  { key: "contato", label: "Contato (telefone, WhatsApp, e-mail)", required: false },
  { key: "redes", label: "Redes sociais", required: false },
  { key: "lgpd", label: "Política de Privacidade e Termos de Uso (LGPD)", required: true },
  { key: "cookies", label: "Aviso de cookies / consentimento", required: true },
] as const;
export type SectionKey = (typeof PUBLIC_SECTIONS)[number]["key"];

/** Prazo em que o autor ainda pode corrigir uma evolução; depois, só com nova evolução (adendo). */
export const EDIT_WINDOW_HOURS = 24;

/** Pedidos do titular dos dados (LGPD art. 18) feitos pela Área do paciente. */
export const PRIVACY_REQUEST_KINDS = {
  CORRECAO: "Corrigir dados que não consigo editar (nome, CPF, nascimento)",
  REVOGACAO: "Revogar meu consentimento de uso de dados",
  EXCLUSAO: "Excluir meus dados",
  OUTRO: "Outro pedido sobre meus dados",
} as const;

/** Situação de um lote de guias TISS. */
export const TISS_STATUS = {
  GERADO: { label: "Gerado", tone: "blue" },
  ENVIADO: { label: "Enviado", tone: "violet" },
  PAGO: { label: "Pago", tone: "green" },
  GLOSADO: { label: "Pago com glosa", tone: "amber" },
  CANCELADO: { label: "Cancelado", tone: "gray" },
} as const;
