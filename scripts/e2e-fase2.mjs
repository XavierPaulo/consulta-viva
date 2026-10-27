// Testes de ponta a ponta da fase 2. Rode com o servidor de desenvolvimento no ar e o banco recém-populado:
//   npm run db:seed && node scripts/e2e-fase2.mjs
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { mkdirSync } from "node:fs";

const B = "http://localhost:3000";
const out = process.env.SHOTS ?? "/tmp/claude-0/shots2";
mkdirSync(out, { recursive: true });
const db = new PrismaClient();
const b = await chromium.launch({ executablePath: process.env.CHROME });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errors = [];
let failed = 0;
p.on("pageerror", (e) => errors.push("pageerror " + e.message));
// "caret-color" é injetado pelo próprio Playwright ao tirar print durante a hidratação; não é erro do app
p.on("console", (m) => m.type() === "error" && !/meet\.jit\.si|ERR_TUNNEL|ERR_CONNECTION|Failed to load resource|caret-color/.test(m.text()) && errors.push("console " + m.text()));
const step = async (name, fn) => {
  try {
    await fn();
    console.log("✓", name);
  } catch (e) {
    failed++;
    console.log("✗", name, e.message.split("\n")[0]);
    await p.screenshot({ path: `${out}/fail-${name.replace(/\W+/g, "_")}.png`, fullPage: true });
  }
};
await ctx.addInitScript(() => localStorage.setItem("cv_cookies", "todos"));

// ---------- Área do paciente ----------
await step("área do paciente exige login", async () => {
  await p.goto(B + "/paciente");
  await p.waitForURL(/paciente\/entrar/);
});
await step("CPF sem cadastro recebe a mesma resposta (não revela quem é paciente)", async () => {
  await p.fill("#cpf", "935.411.347-80");
  await p.getByRole("button", { name: "Receber código de acesso" }).click();
  await p.getByText("Se houver cadastro com este CPF").waitFor();
  if (await p.getByText("Modo demonstração").count()) throw new Error("mostrou código para CPF sem cadastro");
  await p.getByRole("button", { name: /Não recebi/ }).click();
});
await step("código errado é recusado", async () => {
  await p.fill("#cpf", "529.982.247-25");
  await p.getByRole("button", { name: "Receber código de acesso" }).click();
  await p.getByText("Modo demonstração").waitFor();
  await p.fill("#code", "000000");
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.getByText(/Código incorreto|inválido/).waitFor();
});
await step("entrar com o código", async () => {
  const code = (await p.locator("strong.tracking-widest").textContent()).trim();
  await p.fill("#code", code);
  await p.screenshot({ path: `${out}/paciente-codigo.png`, fullPage: true });
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.waitForURL(B + "/paciente");
  await p.getByRole("heading", { name: "Próximas consultas" }).waitFor();
  await p.getByRole("link", { name: "Entrar na sala" }).waitFor();
  await p.screenshot({ path: `${out}/paciente-inicio.png`, fullPage: true });
});
await step("consultas, receitas, recibo", async () => {
  await p.goto(B + "/paciente/consultas");
  await p.getByRole("heading", { name: "Histórico" }).waitFor();
  await p.screenshot({ path: `${out}/paciente-consultas.png`, fullPage: true });
  await p.goto(B + "/paciente/receitas");
  await p.locator('a[href^="/paciente/receitas/"]').first().click();
  await p.getByRole("heading", { name: "RECEITUÁRIO" }).waitFor();
  if (await p.getByText("Fadiga a esclarecer").count()) throw new Error("receita do paciente expõe o SOAP");
  await p.screenshot({ path: `${out}/paciente-receita.png`, fullPage: true });
  await p.goto(B + "/paciente/pagamentos");
  await p.getByRole("link", { name: "Recibo" }).first().click();
  await p.getByRole("heading", { name: "RECIBO" }).waitFor();
});
await step("não abre receita de outro paciente", async () => {
  const other = await db.medicalRecord.findFirst({ where: { patient: { cpf: { not: "52998224725" } }, prescriptions: { some: {} } } });
  const r = await p.goto(B + `/paciente/receitas/${other.id}`);
  if (r.status() !== 404) throw new Error("status " + r.status());
});
await step("meus dados, lembretes e pedido LGPD", async () => {
  await p.goto(B + "/paciente/dados");
  await p.fill("#email", "fernanda.nova@email.com");
  await p.uncheck('input[name="reminders"]');
  await p.getByRole("button", { name: "Salvar", exact: true }).click();
  await p.getByText("Dados atualizados").waitFor();
  const pat = await db.patient.findFirst({ where: { cpf: "52998224725" } });
  if (pat.email !== "fernanda.nova@email.com" || !pat.remindersOptOut) throw new Error("não salvou");
  await db.patient.update({ where: { id: pat.id }, data: { remindersOptOut: false } });
  await p.selectOption("#kind", "CORRECAO");
  await p.fill("#details", "Meu nome tem acento: Fernánda.");
  await p.getByRole("button", { name: "Enviar pedido" }).click();
  await p.getByText("Pedido registrado").waitFor();
  const res = await p.request.get(B + "/paciente/exportar");
  const json = await res.json();
  if (!json.records?.length || json.cpf !== "52998224725") throw new Error("exportação incompleta");
  await p.screenshot({ path: `${out}/paciente-dados.png`, fullPage: true });
});

// ---------- Teleconsulta (paciente) ----------
await step("sala: termo de consentimento e teste de câmera", async () => {
  await p.goto(B + "/consulta/demo-teleconsulta/sala");
  await p.getByText("Termo de consentimento da teleconsulta").waitFor();
  await p.check('input[name="consent"]');
  await p.getByRole("button", { name: "Concordo e quero continuar" }).click();
  await p.getByRole("button", { name: /Entrar na consulta/ }).waitFor();
  await p.screenshot({ path: `${out}/tele-paciente.png`, fullPage: true });
});
await step("sala: entrar abre a chamada em outra aba", async () => {
  // o servidor de vídeo é externo; no teste respondemos no lugar dele
  await ctx.route("https://meet.jit.si/**", (r) => r.fulfill({ contentType: "text/html", body: "<title>Jitsi</title>sala" }));
  const [popup] = await Promise.all([ctx.waitForEvent("page"), p.getByRole("button", { name: /Entrar na consulta/ }).click()]);
  if (!popup.url().includes("ConsultaViva-")) throw new Error("url da sala " + popup.url());
  await popup.close();
  await p.getByText("A chamada abriu em outra aba").waitFor();
  const a = await db.appointment.findUnique({ where: { manageToken: "demo-teleconsulta" } });
  if (!a.patientJoinedAt || !a.teleConsentAt) throw new Error("não registrou entrada/consentimento");
});
await step("sair da área do paciente", async () => {
  await p.goto(B + "/paciente");
  await p.getByRole("button", { name: "Sair" }).click();
  await p.waitForURL(/saiu=1/);
});

// ---------- Equipe ----------
await step("login admin", async () => {
  await p.goto(B + "/admin/login");
  await p.fill("#email", "admin@vivasaude.com.br");
  await p.fill("#password", "Viva@2026");
  await p.getByRole("button", { name: "Entrar", exact: true }).click();
  await p.waitForURL(B + "/admin");
});
await step("teleconsulta do médico: presença do paciente e SOAP ao lado", async () => {
  const a = await db.appointment.findUnique({ where: { manageToken: "demo-teleconsulta" } });
  await p.goto(B + `/admin/agenda/${a.id}`);
  await p.getByRole("link", { name: "Sala de vídeo" }).click();
  await p.getByText("Paciente entrou na sala").waitFor();
  await p.screenshot({ path: `${out}/tele-medico.png`, fullPage: true });
  await p.fill("#subjective", "Teleconsulta: paciente refere melhora da fadiga.");
  await p.fill("#plan", "Manter sulfato ferroso. Retorno em 60 dias.");
  await p.getByRole("button", { name: "Salvar no prontuário" }).click();
  await p.getByText("Atendimento registrado no prontuário").waitFor();
  if (!p.url().includes("/sala")) throw new Error("saiu da sala ao salvar");
  const after = await db.appointment.findUnique({ where: { id: a.id } });
  if (after.status !== "REALIZADA") throw new Error("não marcou como realizada");
});
await step("pedido LGPD aparece na ficha e é atendido", async () => {
  const pat = await db.patient.findFirst({ where: { cpf: "52998224725" } });
  await p.goto(B + `/admin/pacientes/${pat.id}`);
  await p.getByText("Pedidos do paciente sobre os dados").waitFor();
  await p.getByRole("button", { name: "Marcar como atendido" }).click();
  await p.getByText("Pedidos do paciente sobre os dados").waitFor({ state: "detached" });
});
await step("lembretes automáticos (24 h) e opt-out", async () => {
  // duas consultas futuras de pacientes diferentes, movidas para daqui a ~20 h e criadas "há 2 dias"
  const future = await db.appointment.findMany({
    where: { status: { in: ["AGENDADA", "CONFIRMADA"] }, start: { gt: new Date(Date.now() + 3 * 3600_000) }, manageToken: { not: "demo-teleconsulta" } },
    include: { patient: true },
    orderBy: { start: "asc" },
  });
  const tomorrow = [future[0], future.find((f) => f.patientId !== future[0]?.patientId)].filter(Boolean);
  if (tomorrow.length < 2) throw new Error("seed sem consultas futuras suficientes");
  for (const [i, t] of tomorrow.entries()) {
    const start = new Date(Date.now() + (20 + i) * 3600_000);
    await db.appointment.update({
      where: { id: t.id },
      data: { start, end: new Date(start.getTime() + 30 * 60_000), createdAt: new Date(Date.now() - 2 * 86400_000), reminder24hAt: null },
    });
  }
  const optOut = tomorrow[0].patient;
  await db.patient.update({ where: { id: optOut.id }, data: { remindersOptOut: true } });
  const before = await db.notification.count({ where: { subject: { startsWith: "Lembrete" } } });
  await p.goto(B + "/admin/configuracoes?aba=lembretes");
  await p.screenshot({ path: `${out}/config-lembretes.png`, fullPage: true });
  await p.getByRole("button", { name: "Verificar agora" }).click();
  await p.getByText(/lembrete\(s\) enviado\(s\)|Nenhum lembrete/).waitFor();
  const sent = await db.notification.findMany({ where: { subject: { startsWith: "Lembrete" } }, orderBy: { createdAt: "desc" } });
  if (sent.length <= before) throw new Error("nenhum lembrete registrado");
  if (sent.some((n) => n.to === optOut.phone || n.to === optOut.email)) throw new Error("enviou para quem pediu para não receber");
  if (!sent[0].body.includes("http://localhost:3000/consulta/")) throw new Error("lembrete sem link absoluto: " + sent[0].body);
  // segunda execução não repete
  await p.getByRole("button", { name: "Verificar agora" }).click();
  await p.getByText("Nenhum lembrete pendente").waitFor();
  await db.patient.update({ where: { id: optOut.id }, data: { remindersOptOut: false } });
});
await step("configurações de telemedicina e convênio (TISS)", async () => {
  await p.goto(B + "/admin/configuracoes?aba=telemedicina");
  await p.getByLabel("Servidor de vídeo (Jitsi)").waitFor();
  await p.goto(B + "/admin/configuracoes?aba=convenios");
  await p.getByText("Faturamento TISS").first().waitFor();
});
await step("repasse do mês", async () => {
  await p.goto(B + "/admin/financeiro/repasse");
  await p.screenshot({ path: `${out}/repasse.png`, fullPage: true });
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: "Registrar repasse" }).first().click();
  await p.getByText(/Repassado em/).first().waitFor();
  if (!(await db.payout.count())) throw new Error("repasse não gravado");
});
await step("conciliação: automática + importação de extrato", async () => {
  await p.goto(B + "/admin/financeiro/conciliacao");
  await p.getByRole("button", { name: "Tentar conciliar de novo" }).click();
  await p.getByText(/conciliado\(s\)/).waitFor();
  const rec = await db.payment.findMany({ where: { reconciledAt: { not: null } } });
  if (!rec.length) throw new Error("nada conciliado");
  if (!rec.some((x) => x.feeCents > 0)) throw new Error("taxa do cartão não calculada");
  await p.getByText("Ou cole as linhas").click();
  await p.fill('textarea[name="text"]', "Data;Histórico;Valor\n20/10/2026;DOC RECEBIDO TESTE;123,45\n21/10/2026;TARIFA;-9,90");
  await p.getByRole("button", { name: "Importar e conciliar" }).click();
  await p.getByText(/2 lançamento\(s\) importado\(s\)/).waitFor();
  await p.screenshot({ path: `${out}/conciliacao.png`, fullPage: true });
});
let batchId = "";
await step("convênios: gerar lote TISS e baixar XML", async () => {
  await p.goto(B + "/admin/financeiro/convenios");
  await p.screenshot({ path: `${out}/convenios.png`, fullPage: true });
  await p.getByRole("button", { name: "Gerar lote de guias" }).first().click();
  await p.getByText(/Lote 1 \(.*\) gerado/).waitFor();
  const batch = await db.tissBatch.findFirst({ orderBy: { createdAt: "desc" } });
  batchId = batch.id;
  const res = await p.request.get(B + `/admin/api/tiss/${batch.id}`);
  const xml = Buffer.from(await res.body()).toString("latin1");
  for (const t of ["<ans:mensagemTISS", "<ans:guiaConsulta>", "<ans:numeroCarteira>", "<ans:CNES>2077485</ans:CNES>", "<ans:hash>"]) if (!xml.includes(t)) throw new Error("XML sem " + t);
  (await import("node:fs")).writeFileSync(`${out}/lote.xml`, Buffer.from(await res.body()));
});
await step("convênios: retorno com glosa vira pagamento", async () => {
  await p.goto(B + "/admin/financeiro/convenios");
  await p.getByText("Registrar pagamento da operadora").first().click();
  const batch = await db.tissBatch.findUnique({ where: { id: batchId } });
  await p.fill(`#rec-${batchId}`, ((batch.totalCents - 2000) / 100).toFixed(2).replace(".", ","));
  await p.fill(`#not-${batchId}`, "Glosa parcial: código de validação ausente");
  await p.getByRole("button", { name: "Registrar", exact: true }).click();
  await p.getByText(/registrado com glosa de/).waitFor();
  const pays = await db.payment.findMany({ where: { gatewayRef: `lote-${batch.number}`, method: "CONVENIO" } });
  const sum = pays.reduce((s, x) => s + x.amountCents, 0);
  if (sum !== batch.totalCents - 2000) throw new Error(`soma ${sum}`);
});
await step("médico vê só o próprio repasse", async () => {
  await p.getByRole("button", { name: "Sair" }).click();
  await p.waitForURL(/login/);
  await p.fill("#email", "ana@vivasaude.com.br");
  await p.fill("#password", "Viva@2026");
  await p.getByRole("button", { name: "Entrar", exact: true }).click();
  await p.waitForURL(B + "/admin");
  await p.goto(B + "/admin/financeiro/repasse");
  await p.getByText("Seu repasse").waitFor();
  if (await p.getByText("Carlos Eduardo").count()) throw new Error("médica vê repasse de outro profissional");
  if (await p.getByRole("link", { name: "Conciliação" }).count()) throw new Error("médica vê aba de conciliação");
  const r = await p.request.get(B + `/admin/api/tiss/${batchId}`);
  if (r.status() !== 403) throw new Error("médica baixou XML TISS");
});
await step("mobile: área do paciente sem rolagem lateral", async () => {
  const m = await b.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto(B + "/paciente/entrar");
  await m.screenshot({ path: `${out}/m-paciente-entrar.png` });
  await m.goto(B + "/consulta/demo-teleconsulta/sala");
  await m.screenshot({ path: `${out}/m-sala.png`, fullPage: true });
  const sw = await m.evaluate(() => document.documentElement.scrollWidth);
  if (sw > 390) throw new Error("scroll horizontal " + sw);
});

console.log("ERRORS:", errors.slice(0, 10));
await b.close();
await db.$disconnect();
process.exit(failed || errors.length ? 1 : 0);
