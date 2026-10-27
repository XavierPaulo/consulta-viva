# ConsultaViva — fases 1 e 2

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

Área do paciente: http://localhost:3000/paciente — entre com o CPF `529.982.247-25` (Fernanda, paciente de demonstração). Sem provedor de mensagens configurado, o código de acesso aparece na tela.

Teleconsulta de demonstração: o seed cria uma consulta por vídeo da Fernanda com a Dra. Marina para daqui a ~10 minutos. Paciente: http://localhost:3000/consulta/demo-teleconsulta/sala · Médico: Agenda → consulta → **Sala de vídeo**.

Testes de ponta a ponta no navegador (com o servidor rodando; rode `npm run db:seed` antes de cada um para partir do zero):

```bash
CHROME=/caminho/do/chrome node scripts/e2e.mjs        # fase 1
CHROME=/caminho/do/chrome node scripts/e2e-fase2.mjs  # fase 2
```

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

## Fase 2

**Área do paciente** (`/paciente`)
- Entrada sem senha: CPF + código de 6 dígitos enviado ao WhatsApp e ao e-mail cadastrados (vale 10 min, 5 tentativas, no máximo 3 códigos a cada 15 min). A resposta é a mesma com ou sem cadastro, para ninguém descobrir pelo CPF quem é paciente da clínica.
- Próximas consultas com confirmar presença, entrar na teleconsulta, pagar e remarcar/cancelar; histórico; receitas para imprimir (sem as anotações clínicas do SOAP); pagamentos com recibo.
- Meus dados: celular, e-mail, endereço e a opção de não receber lembretes. Privacidade (LGPD): baixar todos os dados (inclusive prontuário) e pedir correção, revogação ou exclusão; os pedidos aparecem na ficha do paciente para a equipe atender.

**Telemedicina**
- Sala de vídeo Jitsi exclusiva por consulta (nome aleatório), aberta de 30 min antes até 1 h depois do horário.
- Paciente: termo de consentimento (Resolução CFM 2.314/2022, editável), teste de câmera e microfone, entrada pelo navegador sem instalar nada.
- Médico: botão **Sala de vídeo** na consulta, aviso de quando o paciente entrou e o SOAP ao lado; ao salvar, a consulta é marcada como realizada sem sair da sala.
- **Transcrição e rascunho do prontuário:** se o paciente autorizar no termo (opcional, pode retirar depois), o médico clica em **Transcrever consulta**. O microfone dele e o som da aba da chamada vão direto do navegador para o Deepgram (streaming ao vivo, pt-BR), e as falas aparecem separadas em "Médico" e "Paciente". **Gerar rascunho do SOAP** manda o texto ao Claude, que preenche S, O, A, P e a receita sem apagar o que o médico já escreveu. Nada vai para o prontuário sem o médico salvar; o áudio não é gravado e a transcrição fica só no navegador até fechar a aba. Sem `DEEPGRAM_API_KEY`/`ANTHROPIC_API_KEY`, funciona em modo de demonstração com uma conversa de exemplo. O pedido ao Claude usa o fallback automático da API (`fallbacks: "default"`), que repete o pedido em outro modelo se o primeiro recusar.
- Servidor configurável (Configurações → Telemedicina). Com o meet.jit.si gratuito a chamada abre em outra aba (o serviço encerra vídeos incorporados em sites após 5 min e pede login do médico na primeira vez). Com Jitsi próprio ou JaaS, marque "abrir dentro do sistema" e o vídeo fica na mesma tela do prontuário.

**Lembretes automáticos**
- 24 h antes (com pedido de confirmação) e 2 h antes, pelos canais escolhidos (WhatsApp, SMS, e-mail), com texto editável e variáveis. Cada consulta recebe cada lembrete uma vez; quem pediu para não receber fica de fora.
- O servidor verifica a cada 5 min (`src/instrumentation.ts`). Em hospedagem serverless, desligue com `REMINDERS_INTERVAL_MINUTES=0` e chame `GET /api/cron/lembretes` com `Authorization: Bearer $CRON_SECRET`.
- Provedores reais prontos em `src/lib/notify.ts`: WhatsApp Business (Meta Cloud API), SMS (Twilio) e e-mail (Resend). Basta preencher as variáveis do `.env.example`; sem elas o envio fica simulado. Para lembretes no WhatsApp, a Meta exige um modelo de mensagem aprovado (`WHATSAPP_TEMPLATE`).

**Financeiro completo**
- Repasse: por profissional e mês, soma o que foi recebido nas consultas dele, desconta as taxas e aplica o percentual do cadastro (Profissionais → Repasse). Registro do repasse pago, com histórico; o médico vê só o próprio.
- Conciliação: importa o extrato do banco ou da maquininha (OFX ou CSV, inclusive em ISO-8859-1), liga sozinho cada lançamento ao pagamento correspondente (valor exato ou valor menos a taxa configurada, dentro do prazo de cada forma) e calcula a taxa cobrada. O que fica em dúvida aparece com sugestões para vincular ou ignorar; dinheiro é conferido no caixa.
- Taxas de crédito, débito e PIX e o CNES da clínica em Configurações → Financeiro.

**Convênios (TISS)**
- Consultas realizadas por convênio entram na lista "a faturar"; o sistema aponta o que falta (registro ANS, código na operadora, CNES, carteirinha).
- Gera o lote de Guias de Consulta no Padrão TISS 4.01.00 (XML em ISO-8859-1 com o hash MD5 do epílogo) para enviar no portal da operadora.
- Retorno da operadora: valor pago e glosa. O valor é distribuído entre as consultas do lote como pagamentos "Convênio", que entram no repasse e na conciliação.
- Valide o primeiro lote no portal de cada operadora: algumas exigem campos opcionais (por exemplo, código de validação ou número da guia na operadora).

## Ainda simulado (troca simples depois)

- **Envio de mensagens** enquanto os provedores não estiverem configurados (registrado em Comunicação).
- **Gateway de pagamento**: `src/lib/payments.ts` define a interface `PaymentGateway` e um gateway simulado. Implemente Stripe, Mercado Pago, Asaas ou PagSeguro nela.

## Stack

Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS 4, Prisma 6 (SQLite em desenvolvimento, PostgreSQL em produção), bcrypt para senhas, sessões no banco com cookie httpOnly.

## Estrutura

```
prisma/schema.prisma        modelo de dados
prisma/seed.ts              dados de demonstração
src/app/(site)/             site público e agendamento
src/app/admin/              login, recuperação de senha e área interna
src/app/(site)/paciente/    Área do paciente
src/lib/                    regras: auth, permissões, horários, formatação, gateway, notificações,
                            lembretes, vídeo, TISS, extrato/conciliação, repasse
src/components/             componentes de interface
scripts/e2e.mjs             teste de ponta a ponta com Playwright (fase 1)
scripts/e2e-fase2.mjs       teste de ponta a ponta da fase 2
```
