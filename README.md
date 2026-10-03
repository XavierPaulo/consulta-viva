# ConsultaViva — MVP (fase 1)

Plataforma para clínicas e consultórios: site público com agendamento online e área interna com agenda, pacientes, prontuário, pagamentos e relatórios.

## Como rodar

Requer Node.js 20+.

```bash
npm install
cp .env.example .env
npm run setup     # cria o banco e carrega dados de demonstração
npm run dev       # http://localhost:3000
```

Área interna: http://localhost:3000/admin — senha de todos os usuários de demonstração: `Viva@2026`

| Perfil | E-mail |
|---|---|
| Administrador | admin@vivasaude.com.br |
| Médico (Dra. Ana) | ana@vivasaude.com.br |
| Secretária / Recepção | recepcao@vivasaude.com.br |
| Somente leitura | auditor@vivasaude.com.br |

Teste de ponta a ponta no navegador (com o servidor rodando): `CHROME=/caminho/do/chrome node scripts/e2e.mjs` (rode `npm run db:seed` antes para partir do zero).

## O que está pronto

**Área pública**
- Página inicial com identidade visual (nome, frase, cor da marca, logo), especialidades em cards filtráveis (por texto/sintoma e teleconsulta), profissionais, formas de pagamento, horário de funcionamento e unidades, convênios, depoimentos autorizados, FAQ, contato e redes sociais.
- Regra de campos obrigatórios (*): seções obrigatórias sempre aparecem; as opcionais têm checkbox "Ocultar" em Configurações → Página pública e somem sozinhas enquanto não tiverem conteúdo.
- Perfil do profissional: foto, CRM, especialidades, formação, experiência, grade semanal, convênios, agenda dos próximos 14 dias e mensagem direta.
- Comunicação direta: a mensagem vai para a caixa de entrada do médico/equipe; a resposta sai pelo WhatsApp ou e-mail escolhido pelo paciente.
- Aviso de cookies com consentimento, Política de Privacidade e Termos de Uso editáveis.

**Agendamento online**
- Busca por especialidade, médico ou sintoma; filtros por especialidade, médico, unidade, data, turno, convênio e tipo.
- Horários livres calculados em tempo real (grade do profissional menos consultas marcadas, com antecedência mínima configurável) e checagem contra dupla marcação no momento de confirmar.
- Identificação: paciente novo (cadastro rápido com validação de CPF) ou existente (CPF + telefone).
- Presencial ou teleconsulta, convênio ou particular, resumo com médico, local, valor e política de cancelamento, consentimento LGPD para dados de saúde.
- Confirmação por e-mail e WhatsApp, link para cancelar/remarcar respeitando o prazo configurado, pagamento antecipado opcional via link (PIX ou cartão com parcelamento).

**Área interna**
- Login com e-mail e senha, recuperação de senha por link, bloqueio após 5 tentativas (15 min), sessão que expira após 30 min sem uso (e no máximo 10 h), botão de SSO reservado.
- Perfis Administrador, Médico, Secretária e Somente leitura, com permissões por módulo e ação e permissões extras por usuário. Médicos veem só a própria agenda e os próprios prontuários; recepção não acessa prontuário.
- Painel com KPIs do dia e do mês e agenda de hoje.
- Agenda por dia e profissional com horários livres clicáveis, novo agendamento com busca de paciente e cadastro rápido, encaixe, remarcação, confirmação, realizada/falta, cancelamento com motivo e lembrete.
- Pacientes: busca, cadastro, ficha com linha do tempo do prontuário, consultas, pagamentos e exportação dos dados (portabilidade LGPD).
- Prontuário SOAP com prescrição e receita para impressão. Edição só pelo autor em até 24 h; depois, nova evolução (o histórico não é reescrito).
- Financeiro: registro manual, link de pagamento, baixa, estorno, cancelamento, inadimplência, recibo para impressão.
- Relatórios por período: consultas por situação, médico, especialidade e convênio; receita por forma de pagamento, médico e especialidade; taxa de faltas.
- Comunicação: caixa de entrada e histórico de todos os envios.
- Configurações: dados da clínica, página pública, especialidades, convênios, unidades, regras de agendamento, FAQ, depoimentos e textos LGPD.
- Log de auditoria: quem viu, criou, editou, exportou ou imprimiu o quê e quando, além de logins e falhas.

## Simulado no MVP (troca simples depois)

- **Envio de e-mail, SMS e WhatsApp**: registrado em `Notification` e visível em Comunicação → Envios. Plugue o provedor em `src/lib/notify.ts`.
- **Gateway de pagamento**: `src/lib/payments.ts` define a interface `PaymentGateway` e um gateway simulado. Implemente Stripe, Mercado Pago, Asaas ou PagSeguro nela.
- **Lembretes automáticos de 24 h e 1 h**: hoje o lembrete é enviado pelo botão na consulta. O disparo automático entra junto com a integração de WhatsApp/SMS (fase 2).

## Stack

Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS 4, Prisma 6 (SQLite em desenvolvimento, PostgreSQL em produção), bcrypt para senhas, sessões no banco com cookie httpOnly.

## Estrutura

```
prisma/schema.prisma        modelo de dados
prisma/seed.ts              dados de demonstração
src/app/(site)/             site público e agendamento
src/app/admin/              login, recuperação de senha e área interna
src/lib/                    regras: auth, permissões, horários, formatação, gateway, notificações
src/components/             componentes de interface
scripts/e2e.mjs             teste de ponta a ponta com Playwright
```
