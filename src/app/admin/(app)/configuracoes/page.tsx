import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getClinic } from "@/lib/clinic";
import { PAYMENT_METHODS, PUBLIC_SECTIONS } from "@/lib/constants";
import { centsToInput, parseJson } from "@/lib/format";
import { DEFAULT_TELE_CONSENT } from "@/lib/video";
import { DEFAULT_REMINDER_TEMPLATE, REMINDER_VARS } from "@/lib/reminders";
import { providerFor } from "@/lib/notify";
import type { ClinicData } from "@/lib/clinic";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/client";
import { Badge, Field, PageHeader, SPECIALTY_ICON_KEYS } from "@/components/ui";
import {
  deleteFaq,
  deleteTestimonial,
  saveClinic,
  saveFaq,
  saveInsurance,
  saveLegal,
  savePublicPage,
  saveFinanceSettings,
  saveReminders,
  saveRules,
  saveTelemedicine,
  runRemindersNow,
  saveSpecialty,
  saveTestimonial,
  saveUnit,
} from "./actions";

export const metadata = { title: "Configurações" };

const TABS = [
  ["clinica", "Dados da clínica"],
  ["pagina", "Página pública"],
  ["especialidades", "Especialidades"],
  ["convenios", "Convênios"],
  ["unidades", "Unidades"],
  ["regras", "Regras de agendamento"],
  ["lembretes", "Lembretes"],
  ["telemedicina", "Telemedicina"],
  ["financeiro", "Financeiro"],
  ["conteudo", "FAQ e depoimentos"],
  ["lgpd", "Privacidade (LGPD)"],
] as const;

const chk = "flex min-h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm has-checked:border-brand has-checked:bg-brand-50";

export default async function Configuracoes({ searchParams }: PageProps<"/admin/configuracoes">) {
  const sp = await searchParams;
  const user = await requireUser("configuracoes");
  const editable = can(user, "configuracoes", "edit");
  const tab = TABS.find(([k]) => k === sp.aba)?.[0] ?? "clinica";
  const clinic = await getClinic();

  return (
    <>
      <PageHeader title="Configurações" />
      <nav aria-label="Seções das configurações" className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/admin/configuracoes?aba=${k}`} data-active={tab === k} aria-current={tab === k ? "page" : undefined} className="chip shrink-0">
            {l}
          </Link>
        ))}
      </nav>
      <fieldset disabled={!editable} className="max-w-4xl">
        {tab === "clinica" && (
          <ActionForm action={saveClinic} className="card space-y-5 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome da clínica / consultório" htmlFor="name" required>
                <input id="name" name="name" defaultValue={clinic.name} className="input" required />
              </Field>
              <Field label="CNPJ" htmlFor="cnpj">
                <input id="cnpj" name="cnpj" defaultValue={clinic.cnpj} className="input" />
              </Field>
              <Field label="Frase de destaque" htmlFor="tagline" required className="sm:col-span-2">
                <input id="tagline" name="tagline" defaultValue={clinic.tagline} className="input" />
              </Field>
              <Field label="Sobre a clínica" htmlFor="about" required className="sm:col-span-2">
                <textarea id="about" name="about" defaultValue={clinic.about} rows={3} className="input" />
              </Field>
              <Field label="Logo (URL)" htmlFor="logoUrl">
                <input id="logoUrl" name="logoUrl" type="url" defaultValue={clinic.logoUrl} className="input" placeholder="https://…" />
              </Field>
              <Field label="Cor principal" htmlFor="primaryColor" hint="Usada em botões e destaques do site e do sistema.">
                <input id="primaryColor" name="primaryColor" type="color" defaultValue={clinic.primaryColor} className="input h-11 p-1" />
              </Field>
              <Field label="Horário de funcionamento" htmlFor="openingHours" required className="sm:col-span-2">
                <textarea id="openingHours" name="openingHours" defaultValue={clinic.openingHours} rows={2} className="input" />
              </Field>
              <Field label="Endereço" htmlFor="address" className="sm:col-span-2">
                <input id="address" name="address" defaultValue={clinic.address} className="input" />
              </Field>
            </div>
            <h2 className="pt-2 font-semibold">Contato e redes sociais</h2>
            <p className="-mt-3 text-sm text-muted">Campos vazios ficam ocultos no site automaticamente.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Telefone" htmlFor="phone">
                <input id="phone" name="phone" defaultValue={clinic.phone} className="input" />
              </Field>
              <Field label="WhatsApp" htmlFor="whatsapp">
                <input id="whatsapp" name="whatsapp" defaultValue={clinic.whatsapp} className="input" />
              </Field>
              <Field label="E-mail" htmlFor="email">
                <input id="email" name="email" type="email" defaultValue={clinic.email} className="input" />
              </Field>
              {(["instagram", "facebook", "linkedin", "youtube"] as const).map((k) => (
                <Field key={k} label={k[0]!.toUpperCase() + k.slice(1)} htmlFor={k}>
                  <input id={k} name={k} type="url" defaultValue={clinic[k]} className="input" placeholder="https://…" />
                </Field>
              ))}
            </div>
            <SubmitButton>Salvar</SubmitButton>
          </ActionForm>
        )}

        {tab === "pagina" && (
          <ActionForm action={savePublicPage} className="space-y-5">
            <section className="card p-5 sm:p-6">
              <h2 className="font-semibold">Seções da página pública</h2>
              <p className="mt-1 mb-4 text-sm text-muted">
                Seções com <span className="text-red-600">*</span> são obrigatórias e sempre aparecem. As opcionais podem ser ocultadas — e somem sozinhas enquanto não tiverem conteúdo.
              </p>
              <ul className="divide-y divide-line">
                {PUBLIC_SECTIONS.map((s) => (
                  <li key={s.key} className="flex min-h-12 items-center justify-between gap-4 py-2">
                    <span>
                      {s.label}
                      {s.required && <span className="text-red-600"> *</span>}
                    </span>
                    {s.required ? (
                      <Badge tone="teal">Sempre visível</Badge>
                    ) : (
                      <label className="flex shrink-0 items-center gap-2 text-sm">
                        <input type="checkbox" name={`hide_${s.key}`} defaultChecked={clinic.hiddenList.includes(s.key)} className="size-5 accent-[var(--brand)]" /> Ocultar
                      </label>
                    )}
                  </li>
                ))}
              </ul>
            </section>
            <section className="card p-5 sm:p-6">
              <h2 className="font-semibold">
                Formas de pagamento aceitas<span className="text-red-600"> *</span>
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                  <label key={k} className={chk}>
                    <input type="checkbox" name={`pm_${k}`} defaultChecked={clinic.paymentMethodList.includes(k)} className="size-4 accent-[var(--brand)]" /> {v}
                  </label>
                ))}
              </div>
              <Field label="Parcelamento máximo no cartão" htmlFor="maxInstallments" className="mt-4 max-w-xs">
                <select id="maxInstallments" name="maxInstallments" defaultValue={clinic.maxInstallments} className="input">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "À vista" : `Até ${n}x`}
                    </option>
                  ))}
                </select>
              </Field>
            </section>
            <SubmitButton>Salvar página pública</SubmitButton>
          </ActionForm>
        )}

        {tab === "regras" && (
          <ActionForm action={saveRules} className="card space-y-5 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Antecedência mínima para agendar online (h)" htmlFor="minBookingHours">
                <input id="minBookingHours" name="minBookingHours" type="number" min={0} defaultValue={clinic.minBookingHours} className="input" />
              </Field>
              <Field label="Prazo para cancelar/remarcar online (h antes)" htmlFor="cancelMinHours">
                <input id="cancelMinHours" name="cancelMinHours" type="number" min={0} defaultValue={clinic.cancelMinHours} className="input" />
              </Field>
              <Field label="Agenda aberta para os próximos (dias)" htmlFor="bookingWindowDays">
                <input id="bookingWindowDays" name="bookingWindowDays" type="number" min={7} defaultValue={clinic.bookingWindowDays} className="input" />
              </Field>
            </div>
            <Field label="Política de cancelamento (mostrada no resumo do agendamento)" htmlFor="cancellationPolicy">
              <textarea id="cancellationPolicy" name="cancellationPolicy" defaultValue={clinic.cancellationPolicy} rows={3} className="input" />
            </Field>
            <SubmitButton>Salvar regras</SubmitButton>
          </ActionForm>
        )}

        {tab === "lgpd" && (
          <ActionForm action={saveLegal} className="card space-y-5 p-5 sm:p-6">
            <Field label="Política de Privacidade" htmlFor="privacyPolicy" required>
              <textarea id="privacyPolicy" name="privacyPolicy" defaultValue={clinic.privacyPolicy} rows={10} className="input" />
            </Field>
            <Field label="Termos de Uso" htmlFor="termsOfUse" required>
              <textarea id="termsOfUse" name="termsOfUse" defaultValue={clinic.termsOfUse} rows={6} className="input" />
            </Field>
            <SubmitButton>Salvar</SubmitButton>
          </ActionForm>
        )}

        {tab === "lembretes" && <Reminders clinic={clinic} />}
        {tab === "telemedicina" && (
          <ActionForm action={saveTelemedicine} className="card space-y-5 p-5 sm:p-6">
            <Field
              label="Servidor de vídeo (Jitsi)"
              htmlFor="videoBaseUrl"
              hint="Padrão: https://meet.jit.si (gratuito). Para uso intenso, use um Jitsi próprio ou o JaaS (8x8)."
            >
              <input id="videoBaseUrl" name="videoBaseUrl" type="url" defaultValue={clinic.videoBaseUrl} className="input" />
            </Field>
            <label className="flex items-start gap-3 text-[15px]">
              <input type="checkbox" name="videoEmbed" defaultChecked={clinic.videoEmbed} className="mt-0.5 size-5 accent-[var(--brand)]" />
              <span>
                Abrir o vídeo dentro do sistema
                <span className="block text-sm text-muted">
                  Deixe desmarcado com o meet.jit.si: o serviço gratuito encerra chamadas incorporadas em sites após 5 minutos. Com Jitsi próprio ou JaaS, marque para ver vídeo e prontuário lado a lado.
                </span>
              </span>
            </label>
            <Field label="Termo de consentimento da teleconsulta" htmlFor="teleConsentText" hint="O paciente aceita este texto antes de entrar na sala. Em branco, usamos o modelo padrão (Resolução CFM 2.314/2022).">
              <textarea id="teleConsentText" name="teleConsentText" rows={6} defaultValue={clinic.teleConsentText} placeholder={DEFAULT_TELE_CONSENT} className="input" />
            </Field>
            <SubmitButton>Salvar</SubmitButton>
          </ActionForm>
        )}
        {tab === "financeiro" && (
          <ActionForm action={saveFinanceSettings} className="card space-y-5 p-5 sm:p-6">
            <div>
              <h2 className="font-semibold">Taxas da maquininha e do banco</h2>
              <p className="text-sm text-muted">Usadas na conciliação para reconhecer o valor que cai na conta (valor pago menos a taxa).</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Crédito (%)" htmlFor="feeCredit">
                <input id="feeCredit" name="feeCredit" inputMode="decimal" defaultValue={bpToInput(clinic.feeCreditBp)} className="input" placeholder="3,49" />
              </Field>
              <Field label="Débito (%)" htmlFor="feeDebit">
                <input id="feeDebit" name="feeDebit" inputMode="decimal" defaultValue={bpToInput(clinic.feeDebitBp)} className="input" placeholder="1,39" />
              </Field>
              <Field label="PIX / link (%)" htmlFor="feePix">
                <input id="feePix" name="feePix" inputMode="decimal" defaultValue={bpToInput(clinic.feePixBp)} className="input" placeholder="0,99" />
              </Field>
            </div>
            <Field label="CNES da clínica" htmlFor="cnes" hint="7 dígitos. Obrigatório nas guias TISS.">
              <input id="cnes" name="cnes" inputMode="numeric" maxLength={7} defaultValue={clinic.cnes} className="input sm:w-48" />
            </Field>
            <p className="text-sm text-muted">O percentual de repasse de cada profissional fica no cadastro dele, em Profissionais.</p>
            <SubmitButton>Salvar</SubmitButton>
          </ActionForm>
        )}
        {tab === "especialidades" && <Specialties />}
        {tab === "convenios" && <Insurances />}
        {tab === "unidades" && <Units />}
        {tab === "conteudo" && <Content />}
      </fieldset>
    </>
  );
}

async function Specialties() {
  const list = await prisma.specialty.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { professionals: true } } } });
  const form = (s?: (typeof list)[number]) => (
    <ActionForm action={saveSpecialty.bind(null, s?.id ?? null)} className="grid gap-3 sm:grid-cols-2" resetOnSuccess={!s}>
      <Field label="Nome" htmlFor={`n-${s?.id ?? "new"}`} required>
        <input id={`n-${s?.id ?? "new"}`} name="name" defaultValue={s?.name} className="input" required />
      </Field>
      <Field label="Ícone" htmlFor={`i-${s?.id ?? "new"}`}>
        <select id={`i-${s?.id ?? "new"}`} name="icon" defaultValue={s?.icon ?? "stethoscope"} className="input">
          {SPECIALTY_ICON_KEYS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </Field>
      <Field label="Descrição" htmlFor={`d-${s?.id ?? "new"}`} className="sm:col-span-2">
        <input id={`d-${s?.id ?? "new"}`} name="description" defaultValue={s?.description} className="input" />
      </Field>
      <Field label="Sintomas e palavras-chave (para a busca)" htmlFor={`s-${s?.id ?? "new"}`} className="sm:col-span-2" hint="Separe por vírgula. Ex.: dor no peito, pressão alta">
        <input id={`s-${s?.id ?? "new"}`} name="symptoms" defaultValue={s?.symptoms} className="input" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={s?.active ?? true} className="size-4 accent-[var(--brand)]" /> Ativa
      </label>
      <div className="sm:col-span-2">
        <SubmitButton className="btn-primary btn-sm">{s ? "Salvar" : "Adicionar especialidade"}</SubmitButton>
      </div>
    </ActionForm>
  );
  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Nova especialidade</h2>
        {form()}
      </section>
      <ul className="space-y-2">
        {list.map((s) => (
          <li key={s.id}>
            <details className="card p-4">
              <summary className="flex cursor-pointer items-center justify-between gap-3">
                <span className="font-medium">{s.name}</span>
                <span className="flex gap-2">
                  {!s.active && <Badge>Inativa</Badge>}
                  <Badge tone="teal">{s._count.professionals} profissionais</Badge>
                </span>
              </summary>
              <div className="mt-4">{form(s)}</div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function Insurances() {
  const list = await prisma.insurance.findMany({ orderBy: { name: "asc" } });
  const form = (s?: (typeof list)[number]) => (
    <ActionForm action={saveInsurance.bind(null, s?.id ?? null)} className="flex flex-wrap items-end gap-3" resetOnSuccess={!s}>
      <Field label="Nome do convênio" htmlFor={`in-${s?.id ?? "new"}`} required className="min-w-56 flex-1">
        <input id={`in-${s?.id ?? "new"}`} name="name" defaultValue={s?.name} className="input" required />
      </Field>
      <Field label="Valor tabela (R$)" htmlFor={`ip-${s?.id ?? "new"}`} className="w-40">
        <input id={`ip-${s?.id ?? "new"}`} name="price" inputMode="decimal" defaultValue={s?.priceCents != null ? centsToInput(s.priceCents) : ""} className="input" />
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={s?.active ?? true} className="size-4 accent-[var(--brand)]" /> Ativo
      </label>
      <details className="w-full rounded-xl border border-line px-3 py-2" open={!!s && !s.ansCode}>
        <summary className="cursor-pointer text-sm font-medium">Faturamento TISS {s && !s.ansCode && <span className="text-amber-700">(preencha para gerar guias)</span>}</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <Field label="Registro ANS" htmlFor={`ians-${s?.id ?? "new"}`} hint="6 dígitos">
            <input id={`ians-${s?.id ?? "new"}`} name="ansCode" inputMode="numeric" maxLength={6} defaultValue={s?.ansCode} className="input" />
          </Field>
          <Field label="Código da clínica na operadora" htmlFor={`ipc-${s?.id ?? "new"}`}>
            <input id={`ipc-${s?.id ?? "new"}`} name="providerCode" defaultValue={s?.providerCode} className="input" />
          </Field>
          <Field label="Procedimento (TUSS)" htmlFor={`itu-${s?.id ?? "new"}`} hint="10101012 = consulta em consultório">
            <input id={`itu-${s?.id ?? "new"}`} name="tussCode" defaultValue={s?.tussCode ?? "10101012"} className="input" />
          </Field>
          <Field label="Versão TISS" htmlFor={`itv-${s?.id ?? "new"}`}>
            <select id={`itv-${s?.id ?? "new"}`} name="tissVersion" defaultValue={s?.tissVersion ?? "4.01.00"} className="input">
              <option>4.01.00</option>
            </select>
          </Field>
        </div>
      </details>
      <SubmitButton className="btn-primary">{s ? "Salvar" : "Adicionar"}</SubmitButton>
    </ActionForm>
  );
  return (
    <div className="card divide-y divide-line">
      <div className="p-5">{form()}</div>
      {list.map((s) => (
        <div key={s.id} className="p-5">
          {form(s)}
        </div>
      ))}
    </div>
  );
}

async function Units() {
  const list = await prisma.unit.findMany({ orderBy: { name: "asc" } });
  const form = (s?: (typeof list)[number]) => (
    <ActionForm action={saveUnit.bind(null, s?.id ?? null)} className="flex flex-wrap items-end gap-3" resetOnSuccess={!s}>
      <Field label="Unidade" htmlFor={`un-${s?.id ?? "new"}`} required className="min-w-48 flex-1">
        <input id={`un-${s?.id ?? "new"}`} name="name" defaultValue={s?.name} className="input" required />
      </Field>
      <Field label="Endereço" htmlFor={`ua-${s?.id ?? "new"}`} className="min-w-64 flex-[2]">
        <input id={`ua-${s?.id ?? "new"}`} name="address" defaultValue={s?.address} className="input" />
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={s?.active ?? true} className="size-4 accent-[var(--brand)]" /> Ativa
      </label>
      <SubmitButton className="btn-primary">{s ? "Salvar" : "Adicionar"}</SubmitButton>
    </ActionForm>
  );
  return (
    <div className="card divide-y divide-line">
      <div className="p-5">{form()}</div>
      {list.map((s) => (
        <div key={s.id} className="p-5">
          {form(s)}
        </div>
      ))}
    </div>
  );
}

async function Content() {
  const [faq, testimonials] = await Promise.all([prisma.faqItem.findMany({ orderBy: { order: "asc" } }), prisma.testimonial.findMany({ orderBy: { createdAt: "desc" } })]);
  const faqForm = (f?: (typeof faq)[number]) => (
    <ActionForm action={saveFaq.bind(null, f?.id ?? null)} className="grid gap-3 sm:grid-cols-[1fr_90px]" resetOnSuccess={!f}>
      <Field label="Pergunta" htmlFor={`q-${f?.id ?? "new"}`} required>
        <input id={`q-${f?.id ?? "new"}`} name="question" defaultValue={f?.question} className="input" required />
      </Field>
      <Field label="Ordem" htmlFor={`o-${f?.id ?? "new"}`}>
        <input id={`o-${f?.id ?? "new"}`} name="order" type="number" defaultValue={f?.order ?? faq.length + 1} className="input" />
      </Field>
      <Field label="Resposta" htmlFor={`a-${f?.id ?? "new"}`} required className="sm:col-span-2">
        <textarea id={`a-${f?.id ?? "new"}`} name="answer" defaultValue={f?.answer} rows={2} className="input" required />
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <SubmitButton className="btn-primary btn-sm">{f ? "Salvar" : "Adicionar pergunta"}</SubmitButton>
      </div>
    </ActionForm>
  );
  const tForm = (t?: (typeof testimonials)[number]) => (
    <ActionForm action={saveTestimonial.bind(null, t?.id ?? null)} className="grid gap-3 sm:grid-cols-[1fr_120px]" resetOnSuccess={!t}>
      <Field label="Autor (como aparece no site)" htmlFor={`ta-${t?.id ?? "new"}`} required>
        <input id={`ta-${t?.id ?? "new"}`} name="author" defaultValue={t?.author} className="input" required placeholder="Ex.: Maria S." />
      </Field>
      <Field label="Nota" htmlFor={`tr-${t?.id ?? "new"}`}>
        <select id={`tr-${t?.id ?? "new"}`} name="rating" defaultValue={t?.rating ?? 5} className="input">
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} ★
            </option>
          ))}
        </select>
      </Field>
      <Field label="Depoimento" htmlFor={`tt-${t?.id ?? "new"}`} required className="sm:col-span-2">
        <textarea id={`tt-${t?.id ?? "new"}`} name="text" defaultValue={t?.text} rows={2} className="input" required />
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="authorized" defaultChecked={t?.authorized} className="size-4 accent-[var(--brand)]" /> Paciente autorizou a publicação (obrigatório para aparecer no site)
      </label>
      <div className="sm:col-span-2">
        <SubmitButton className="btn-primary btn-sm">{t ? "Salvar" : "Adicionar depoimento"}</SubmitButton>
      </div>
    </ActionForm>
  );
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Perguntas frequentes</h2>
        <div className="card mb-3 p-5">{faqForm()}</div>
        <ul className="space-y-2">
          {faq.map((f) => (
            <li key={f.id}>
              <details className="card p-4">
                <summary className="cursor-pointer font-medium">{f.question}</summary>
                <div className="mt-4 space-y-3">
                  {faqForm(f)}
                  <form action={deleteFaq.bind(null, f.id)}>
                    <SubmitButton className="btn-danger btn-sm" pendingText="…" confirm="Excluir esta pergunta?">
                      Excluir
                    </SubmitButton>
                  </form>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Depoimentos</h2>
        <div className="card mb-3 p-5">{tForm()}</div>
        <ul className="space-y-2">
          {testimonials.map((t) => (
            <li key={t.id}>
              <details className="card p-4">
                <summary className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="truncate">
                    <span className="font-medium">{t.author}</span> <span className="text-muted">– {t.text}</span>
                  </span>
                  {t.authorized ? <Badge tone="green">Autorizado</Badge> : <Badge tone="amber">Sem autorização</Badge>}
                </summary>
                <div className="mt-4 space-y-3">
                  {tForm(t)}
                  <form action={deleteTestimonial.bind(null, t.id)}>
                    <SubmitButton className="btn-danger btn-sm" pendingText="…" confirm="Excluir este depoimento?">
                      Excluir
                    </SubmitButton>
                  </form>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const bpToInput = (bp: number) => (bp ? (bp / 100).toFixed(2).replace(".", ",") : "");

const CHANNELS = [
  ["WHATSAPP", "WhatsApp"],
  ["SMS", "SMS"],
  ["EMAIL", "E-mail"],
] as const;

async function Reminders({ clinic }: { clinic: ClinicData }) {
  const channels = parseJson<string[]>(clinic.reminderChannels, []);
  const last = await prisma.notification.findMany({ where: { subject: { startsWith: "Lembrete" } }, orderBy: { createdAt: "desc" }, take: 1 });
  return (
    <div className="space-y-4">
      <ActionForm action={saveReminders} className="card space-y-5 p-5 sm:p-6">
        <label className="flex items-center gap-3 text-[15px] font-medium">
          <input type="checkbox" name="remindersEnabled" defaultChecked={clinic.remindersEnabled} className="size-5 accent-[var(--brand)]" /> Enviar lembretes automáticos
        </label>
        <fieldset className="space-y-2">
          <legend className="label">Quando enviar</legend>
          <div className="flex flex-wrap gap-2">
            <label className={chk}>
              <input type="checkbox" name="reminder24h" defaultChecked={clinic.reminder24h} className="size-4 accent-[var(--brand)]" /> 24 h antes (pede confirmação)
            </label>
            <label className={chk}>
              <input type="checkbox" name="reminder2h" defaultChecked={clinic.reminder2h} className="size-4 accent-[var(--brand)]" /> 2 h antes
            </label>
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="label">Canais</legend>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map(([k, l]) => (
              <label key={k} className={chk}>
                <input type="checkbox" name={`ch_${k}`} defaultChecked={channels.includes(k)} className="size-4 accent-[var(--brand)]" /> {l}
                <span className={`text-xs font-semibold ${providerFor(k) ? "text-emerald-700" : "text-amber-700"}`}>{providerFor(k) ? "conectado" : "simulado"}</span>
              </label>
            ))}
          </div>
          <p className="text-sm text-muted">
            “Simulado” significa que a mensagem fica registrada em Comunicação, mas não sai. Para enviar de verdade, configure o provedor no servidor (veja o README).
          </p>
        </fieldset>
        <Field label="Texto do lembrete" htmlFor="reminderTemplate" hint={`Variáveis: ${REMINDER_VARS.join(" ")}`}>
          <textarea id="reminderTemplate" name="reminderTemplate" rows={4} defaultValue={clinic.reminderTemplate || DEFAULT_REMINDER_TEMPLATE} className="input" />
        </Field>
        <SubmitButton>Salvar lembretes</SubmitButton>
      </ActionForm>
      <ActionForm action={runRemindersNow} className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-[15px] text-muted">
          O sistema verifica a cada 5 minutos.
          {last[0] && ` Último lembrete: ${last[0].createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}.`}
        </p>
        <SubmitButton className="btn-secondary" pendingText="Verificando…">
          Verificar agora
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
