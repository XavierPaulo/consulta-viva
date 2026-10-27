import { chromium } from "playwright";
const B = "http://localhost:3000";
const out = "/tmp/claude-0/shots";
const b = await chromium.launch({ executablePath: process.env.CHROME });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push("pageerror " + e.message));
p.on("console", (m) => m.type() === "error" && errors.push("console " + m.text()));
const step = async (name, fn) => { try { await fn(); console.log("✓", name); } catch (e) { console.log("✗", name, e.message.split("\n")[0]); await p.screenshot({ path: `${out}/fail-${name.replace(/\W+/g,"_")}.png` }); } };

await p.addInitScript(() => localStorage.setItem("cv_cookies", "todos"));

// --- Público: agendamento de paciente novo
await step("busca por sintoma", async () => {
  await p.goto(B + "/agendar?q=dor%20no%20peito");
  await p.locator("h2", { hasText: "Carlos Eduardo Lima" }).waitFor();
  if (await p.locator("h2", { hasText: "Juliana" }).count()) throw new Error("filtro por sintoma não filtrou");
});
let manageUrl = "";
await step("agendar paciente novo com pagamento antecipado", async () => {
  await p.goto(B + "/agendar?medico=carlos-eduardo-lima");
  await p.locator('a[aria-label^="Agendar com"]').first().click();
  await p.waitForURL(/confirmar/);
  await p.screenshot({ path: `${out}/confirmar.png`, fullPage: true });
  await p.getByRole("button", { name: "Confirmar agendamento" }).click();
  await p.getByText("Confira os campos destacados").waitFor();
  await p.fill("#b-name", "Teste Automatizado Silva");
  await p.fill("#b-cpf", "935.411.347-80");
  await p.fill("#b-birth", "1990-05-10");
  await p.fill("#b-phone", "11987654321");
  await p.fill("#b-email", "teste@exemplo.com");
  await p.check('input[name="payNow"]');
  await p.check('input[name="lgpd"]');
  await p.getByRole("button", { name: "Confirmar agendamento" }).click();
  await p.waitForURL(/consulta\//);
  await p.getByText("Consulta agendada!").waitFor();
  manageUrl = p.url().split("?")[0];
  await p.screenshot({ path: `${out}/consulta.png`, fullPage: true });
});
await step("pagar pelo link (cartão)", async () => {
  await p.getByRole("link", { name: "Pagar agora" }).click();
  await p.getByRole("tab", { name: /Cartão/ }).click();
  await p.fill("#card", "4111111111111111");
  await p.fill("#exp", "12/30");
  await p.fill("#cvv", "123");
  await p.screenshot({ path: `${out}/pagar.png`, fullPage: true });
  await p.getByRole("button", { name: /^Pagar/ }).click();
  await p.getByText("Pagamento confirmado").first().waitFor();
});
await step("remarcar pelo link", async () => {
  await p.goto(manageUrl);
  // se o primeiro horário livre for daqui a menos de 24 h, a remarcação online fica bloqueada (regra da clínica)
  if (await p.getByText("Alterações online podem ser feitas até").count()) return console.log("  (consulta em menos de 24 h: remarcação bloqueada, como esperado)");
  await p.getByRole("button", { name: "Remarcar" }).click();
  await p.locator('label:has(input[name="start"])').nth(2).click();
  await p.getByRole("button", { name: "Confirmar novo horário" }).click();
  await p.getByText("Pronto! Nova data").waitFor();
});
await step("mensagem pelo site", async () => {
  await p.goto(B + "/#contato");
  await p.fill("#m-name", "Visitante Teste");
  await p.fill("#m-wa", "11977776666");
  await p.fill("#m-body", "Gostaria de saber se atendem aos sábados.");
  await p.check('input[name="consent"]');
  await p.getByRole("button", { name: "Enviar mensagem" }).click();
  await p.getByText("Mensagem enviada").waitFor();
});

// --- Admin
await step("bloqueio após 5 tentativas", async () => {
  for (let i = 0; i < 5; i++) {
    await p.goto(B + "/admin/login");
    await p.fill("#email", "auditor@vivasaude.com.br");
    await p.fill("#password", "errada" + i);
    await p.getByRole("button", { name: "Entrar", exact: true }).click();
    await p.locator('[role="alert"]').waitFor();
  }
  await p.getByText(/bloqueado/).waitFor();
});
await step("login admin", async () => {
  await p.goto(B + "/admin/agenda");
  await p.waitForURL(/login/);
  await p.fill("#email", "admin@vivasaude.com.br");
  await p.fill("#password", "Viva@2026");
  await p.getByRole("button", { name: "Entrar", exact: true }).click();
  await p.waitForURL(/\/admin\/agenda/);
  await p.screenshot({ path: `${out}/admin-agenda.png`, fullPage: true });
  await p.goto(B + "/admin");
  await p.screenshot({ path: `${out}/admin-dashboard.png`, fullPage: true });
});
await step("novo agendamento com cadastro rápido", async () => {
  await p.goto(B + "/admin/agenda/novo");
  await p.getByRole("button", { name: /Cadastre aqui/ }).click();
  await p.fill("#newName", "Paciente Balcão");
  await p.fill("#newPhone", "11955554444");
  await p.selectOption("#professionalId", { label: "Dra. Ana Beatriz Moreira" });
  // próxima segunda
  const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  await p.fill("#date", d.toISOString().slice(0, 10));
  await p.locator('label:has(input[name="start"])').first().click();
  await p.screenshot({ path: `${out}/admin-novo.png`, fullPage: true });
  await p.getByRole("button", { name: "Agendar" }).click();
  await p.waitForURL(/ok=criada/);
});
let apptUrl = "";
await step("abrir consulta e iniciar atendimento (SOAP)", async () => {
  await p.goto(B + "/admin");
  await p.locator('a[href^="/admin/agenda/c"]').first().click();
  apptUrl = p.url();
  await p.screenshot({ path: `${out}/admin-consulta.png`, fullPage: true });
  await p.getByRole("link", { name: /Iniciar atendimento|Ver prontuário/ }).click();
  await p.waitForURL(/prontuario/);
  if (p.url().includes("/novo")) {
    const sel = p.locator("#professionalId");
    if (await sel.count()) await sel.selectOption({ index: 1 });
    await p.fill("#subjective", "Dor de cabeça há 3 dias.");
    await p.fill("#assessment", "Cefaleia tensional.");
    await p.fill("#plan", "Analgésico e retorno se piorar.");
    await p.getByRole("button", { name: "Adicionar medicamento" }).click();
    await p.fill('input[name="medication"]', "Dipirona 500 mg");
    await p.fill('input[name="dosage"]', "1 cp de 6/6h se dor");
    await p.screenshot({ path: `${out}/admin-soap.png`, fullPage: true });
    await p.getByRole("button", { name: "Salvar no prontuário" }).click();
    await p.getByText("Registro salvo").waitFor();
  }
  await p.getByRole("link", { name: "Imprimir receita" }).click();
  await p.getByText("RECEITUÁRIO").waitFor();
});
await step("registrar pagamento e recibo", async () => {
  await p.goto(B + "/admin/financeiro");
  await p.screenshot({ path: `${out}/admin-financeiro.png`, fullPage: true });
  await p.locator('tbody a').first().click();
  const baixa = p.getByRole("button", { name: "Dar baixa (pago)" });
  if (await baixa.count()) { await baixa.click(); await p.getByRole("link", { name: "Emitir recibo" }).waitFor(); }
});
for (const [n, u] of [["relatorios","/admin/relatorios"],["config","/admin/configuracoes?aba=pagina"],["usuarios","/admin/usuarios"],["auditoria","/admin/auditoria"],["mensagens","/admin/mensagens"],["pacientes","/admin/pacientes"],["profissional","/admin/profissionais"],["paciente-ficha",null]]) {
  await step("página " + n, async () => {
    if (u) await p.goto(B + u); else { await p.goto(B + "/admin/pacientes"); await p.locator("tbody a").first().click(); }
    await p.locator("h1").first().waitFor();
    await p.screenshot({ path: `${out}/admin-${n}.png`, fullPage: true });
  });
}
await step("ocultar FAQ na página pública", async () => {
  await p.goto(B + "/admin/configuracoes?aba=pagina");
  await p.check('input[name="hide_faq"]');
  await p.getByRole("button", { name: "Salvar página pública" }).click();
  await p.getByText("Página pública atualizada").waitFor();
  await p.goto(B + "/");
  if (await p.getByText("Perguntas frequentes").count()) throw new Error("FAQ ainda visível");
  await p.goto(B + "/admin/configuracoes?aba=pagina");
  await p.uncheck('input[name="hide_faq"]');
  await p.getByRole("button", { name: "Salvar página pública" }).click();
  await p.getByText("Página pública atualizada").waitFor();
});
await step("responder mensagem", async () => {
  await p.goto(B + "/admin/mensagens");
  await p.fill("#reply", "Atendemos sim, aos sábados das 8h às 12h.");
  await p.getByRole("button", { name: "Enviar resposta" }).click();
  await p.getByText(/Resposta enviada por/).first().waitFor();
});
// RBAC: recepção não vê prontuário/config
await step("RBAC recepção", async () => {
  await p.getByRole("button", { name: "Sair" }).click();
  await p.waitForURL(/login/);
  await p.fill("#email", "recepcao@vivasaude.com.br");
  await p.fill("#password", "Viva@2026");
  await p.getByRole("button", { name: "Entrar", exact: true }).click();
  await p.waitForURL(B + "/admin");
  if (await p.getByRole("link", { name: "Configurações" }).count()) throw new Error("recepção vê Configurações");
  await p.goto(B + "/admin/configuracoes");
  await p.waitForURL(/negado/);
  await p.goto(apptUrl);
  if (await p.getByRole("link", { name: /Iniciar atendimento|Ver prontuário/ }).count()) throw new Error("recepção vê prontuário");
});
await step("mobile home + agendar", async () => {
  const m = await b.newPage({ viewport: { width: 390, height: 844 } });
  await m.addInitScript(() => localStorage.setItem("cv_cookies", "todos"));
  await m.goto(B + "/"); await m.screenshot({ path: `${out}/m-home.png`, fullPage: false });
  await m.goto(B + "/agendar"); await m.screenshot({ path: `${out}/m-agendar.png`, fullPage: true });
  const sw = await m.evaluate(() => document.documentElement.scrollWidth); if (sw > 390) throw new Error("scroll horizontal " + sw);
});
console.log("ERRORS:", errors.slice(0, 10));
await b.close();
