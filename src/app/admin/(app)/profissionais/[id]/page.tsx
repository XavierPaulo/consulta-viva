import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { centsToInput, parseJson } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { AvailabilityEditor } from "@/components/availability-editor";
import { SubmitButton } from "@/components/client";
import { Field, Notice, PageHeader } from "@/components/ui";
import { saveProfessional } from "../actions";

export const metadata = { title: "Profissional" };

export default async function ProfissionalForm({ params, searchParams }: PageProps<"/admin/profissionais/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "novo";
  const user = await requireUser("profissionais", isNew ? "create" : "view");
  const p = isNew ? null : await prisma.professional.findUnique({ where: { id }, include: { specialties: true, insurances: true, availability: true } });
  if (!isNew && !p) notFound();
  const [specialties, insurances, units] = await Promise.all([
    prisma.specialty.findMany({ orderBy: { name: "asc" } }),
    prisma.insurance.findMany({ orderBy: { name: "asc" } }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
  ]);
  const canSave = can(user, "profissionais", isNew ? "create" : "edit");
  const chk = "flex min-h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm has-checked:border-brand has-checked:bg-brand-50";

  return (
    <>
      <PageHeader
        back={{ href: "/admin/profissionais", label: "Profissionais" }}
        title={isNew ? "Novo profissional" : `${p!.title} ${p!.name}`}
        actions={
          p && (
            <Link href={`/profissionais/${p.slug}`} target="_blank" className="btn-secondary">
              <ExternalLink className="size-4" aria-hidden /> Ver página pública
            </Link>
          )
        }
      />
      {sp.ok && (
        <div className="mb-4 max-w-4xl">
          <Notice tone="success">Profissional cadastrado. Para dar acesso ao sistema, crie um usuário com perfil Médico em Usuários e acessos.</Notice>
        </div>
      )}
      <ActionForm action={saveProfessional.bind(null, isNew ? null : id)} className="max-w-4xl space-y-5">
        <fieldset disabled={!canSave} className="space-y-5">
          <section className="card grid gap-4 p-5 sm:grid-cols-6">
            <h2 className="font-semibold sm:col-span-6">Identificação</h2>
            <Field label="Tratamento" htmlFor="title" className="sm:col-span-1">
              <select id="title" name="title" defaultValue={p?.title ?? "Dr(a)."} className="input">
                <option>Dr.</option>
                <option>Dra.</option>
                <option>Dr(a).</option>
              </select>
            </Field>
            <Field label="Nome completo" htmlFor="name" required className="sm:col-span-5">
              <input id="name" name="name" defaultValue={p?.name} required className="input" />
            </Field>
            <Field label="CRM" htmlFor="crm" required className="sm:col-span-2">
              <input id="crm" name="crm" defaultValue={p?.crm} required className="input" />
            </Field>
            <Field label="UF" htmlFor="crmUf" className="sm:col-span-1">
              <input id="crmUf" name="crmUf" defaultValue={p?.crmUf ?? "SP"} maxLength={2} className="input uppercase" />
            </Field>
            <Field label="Foto (URL)" htmlFor="photoUrl" className="sm:col-span-3" hint="Sem foto, mostramos as iniciais.">
              <input id="photoUrl" name="photoUrl" type="url" defaultValue={p?.photoUrl} className="input" placeholder="https://…" />
            </Field>
            <Field label="Fotos adicionais (URLs separadas por espaço)" htmlFor="gallery" className="sm:col-span-6">
              <input id="gallery" name="gallery" defaultValue={parseJson<string[]>(p?.gallery, []).join(" ")} className="input" />
            </Field>
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-semibold">Página pública</h2>
            <fieldset>
              <legend className="label">
                Especialidades<span className="text-red-600">*</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {specialties.map((s) => (
                  <label key={s.id} className={chk}>
                    <input type="checkbox" name="specialties" value={s.id} defaultChecked={p?.specialties.some((x) => x.id === s.id)} className="size-4 accent-[var(--brand)]" /> {s.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Apresentação" htmlFor="bio" required hint="2 ou 3 frases, na linguagem do paciente.">
              <textarea id="bio" name="bio" defaultValue={p?.bio} rows={3} className="input" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Formação" htmlFor="education" required hint="Uma linha por item.">
                <textarea id="education" name="education" defaultValue={p?.education} rows={4} className="input" />
              </Field>
              <Field label="Experiência" htmlFor="experience" required>
                <textarea id="experience" name="experience" defaultValue={p?.experience} rows={4} className="input" />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-[15px]">
              <input type="checkbox" name="published" defaultChecked={p?.published ?? true} className="size-5 accent-[var(--brand)]" /> Mostrar no site e permitir agendamento online
            </label>
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-semibold">Atendimento</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Valor particular (R$)" htmlFor="price">
                <input id="price" name="price" inputMode="decimal" defaultValue={centsToInput(p?.priceCents)} className="input" />
              </Field>
              <Field label="Duração da consulta (min)" htmlFor="durationMin">
                <input id="durationMin" name="durationMin" type="number" min={10} step={5} defaultValue={p?.durationMin ?? 30} className="input" />
              </Field>
              <Field label="Repasse ao profissional (%)" htmlFor="payoutPercent" hint="Sobre o valor líquido recebido">
                <input id="payoutPercent" name="payoutPercent" type="number" min={0} max={100} defaultValue={p?.payoutPercent ?? 70} className="input" />
              </Field>
              <Field label="CBO (guias TISS)" htmlFor="cbo" hint="225125 = médico clínico">
                <input id="cbo" name="cbo" inputMode="numeric" maxLength={6} defaultValue={p?.cbo ?? "225125"} className="input" />
              </Field>
              <Field label="Unidade principal" htmlFor="unitId">
                <select id="unitId" name="unitId" defaultValue={p?.unitId ?? ""} className="input">
                  <option value="">—</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className={chk}>
                <input type="checkbox" name="inPerson" defaultChecked={p?.inPerson ?? true} className="size-4 accent-[var(--brand)]" /> Presencial
              </label>
              <label className={chk}>
                <input type="checkbox" name="telemedicine" defaultChecked={p?.telemedicine} className="size-4 accent-[var(--brand)]" /> Teleconsulta
              </label>
            </div>
            <fieldset>
              <legend className="label">Convênios atendidos</legend>
              <div className="flex flex-wrap gap-2">
                {insurances.map((i) => (
                  <label key={i.id} className={chk}>
                    <input type="checkbox" name="insurances" value={i.id} defaultChecked={p?.insurances.some((x) => x.id === i.id)} className="size-4 accent-[var(--brand)]" /> {i.name}
                  </label>
                ))}
                {insurances.length === 0 && <p className="text-sm text-muted">Cadastre convênios em Configurações.</p>}
              </div>
            </fieldset>
            <div>
              <p className="label">Grade semanal</p>
              <AvailabilityEditor
                units={units.map((u) => ({ id: u.id, name: u.name }))}
                initial={(p?.availability ?? [])
                  .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))
                  .map((a) => ({ weekday: a.weekday, startTime: a.startTime, endTime: a.endTime, unitId: a.unitId ?? "" }))}
              />
            </div>
          </section>
          {canSave && <SubmitButton>{isNew ? "Cadastrar profissional" : "Salvar alterações"}</SubmitButton>}
        </fieldset>
      </ActionForm>
    </>
  );
}
