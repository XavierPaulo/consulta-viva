"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, UserPlus, X } from "lucide-react";
import { MaskedInput } from "./client";

type P = { id: string; name: string; cpf: string | null; phone: string };

const fmtCpf = (c: string | null) => (c && c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : "");

/** Busca de paciente por nome, CPF ou telefone, com cadastro rápido ali mesmo. */
export function PatientPicker({ initial }: { initial?: P | null }) {
  const [selected, setSelected] = useState<P | null>(initial ?? null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<P[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/admin/api/pacientes?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then(setResults)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  if (selected)
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
        <input type="hidden" name="patientId" value={selected.id} />
        <div>
          <p className="font-semibold">{selected.name}</p>
          <p className="text-sm text-muted">{[fmtCpf(selected.cpf), selected.phone].filter(Boolean).join(" · ")}</p>
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setSelected(null)}>
          Trocar
        </button>
      </div>
    );

  if (creating)
    return (
      <div className="space-y-3 rounded-xl border border-line bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Cadastro rápido</p>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setCreating(false)}>
            <X className="size-4" aria-hidden /> Buscar existente
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="newName">
              Nome completo<span className="text-red-600">*</span>
            </label>
            <input id="newName" name="newName" className="input" defaultValue={/\d/.test(q) ? "" : q} required />
          </div>
          <div>
            <label className="label" htmlFor="newPhone">
              Celular<span className="text-red-600">*</span>
            </label>
            <MaskedInput mask="phone" id="newPhone" name="newPhone" required />
          </div>
          <div>
            <label className="label" htmlFor="newCpf">
              CPF
            </label>
            <MaskedInput mask="cpf" id="newCpf" name="newCpf" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="newEmail">
              E-mail
            </label>
            <input id="newEmail" name="newEmail" type="email" className="input" />
          </div>
        </div>
        <p className="text-xs text-muted">Complete o cadastro depois, na ficha do paciente.</p>
      </div>
    );

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-[22px] left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        className="input pl-10"
        placeholder="Busque por nome, CPF ou telefone"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Buscar paciente"
        aria-autocomplete="list"
        autoComplete="off"
      />
      {loading && <Loader2 className="absolute top-3.5 right-3.5 size-4 animate-spin text-muted" aria-hidden />}
      {q.trim().length >= 2 && (
        <ul className="card absolute z-20 mt-1 w-full overflow-hidden p-1 shadow-lg" role="listbox">
          {(q.trim().length >= 2 ? results : []).map((p) => (
            <li key={p.id}>
              <button type="button" role="option" aria-selected={false} className="w-full rounded-lg px-3 py-2 text-left hover:bg-brand-50" onClick={() => setSelected(p)}>
                <span className="block font-medium">{p.name}</span>
                <span className="block text-sm text-muted">{[fmtCpf(p.cpf), p.phone].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
          {!loading && results.length === 0 && <li className="px-3 py-2 text-sm text-muted">Nenhum paciente encontrado.</li>}
          <li>
            <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-medium text-brand-700 hover:bg-brand-50" onClick={() => setCreating(true)}>
              <UserPlus className="size-4" aria-hidden /> Cadastrar novo paciente
            </button>
          </li>
        </ul>
      )}
      {q.trim().length < 2 && (
        <button type="button" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline" onClick={() => setCreating(true)}>
          <UserPlus className="size-4" aria-hidden /> Paciente novo? Cadastre aqui
        </button>
      )}
    </div>
  );
}

type Pro = { id: string; name: string; durationMin: number; priceCents: number; telemedicine: boolean; inPerson: boolean; insurances: { id: string; name: string }[] };

/** Seleção de profissional + data + horário livre (ou encaixe manual). */
export function SlotPicker({
  professionals,
  defaultProfessionalId,
  defaultDate,
  defaultStart,
  lockedProfessional,
}: {
  professionals: Pro[];
  defaultProfessionalId?: string;
  defaultDate: string;
  defaultStart?: string;
  lockedProfessional?: boolean;
}) {
  const [pid, setPid] = useState(defaultProfessionalId ?? professionals[0]?.id ?? "");
  const [date, setDate] = useState(defaultDate);
  const [loaded, setLoaded] = useState<{ key: string; slots: { iso: string; time: string }[] }>({ key: "", slots: [] });
  const slots = loaded.key === `${pid}|${date}` ? loaded.slots : null;
  const [start, setStart] = useState(defaultStart ?? "");
  const [manual, setManual] = useState(false);
  const pro = professionals.find((p) => p.id === pid);

  useEffect(() => {
    if (!pid || !date) return;
    const key = `${pid}|${date}`;
    let stale = false; // ignora respostas antigas se o usuário trocar a data/profissional antes
    fetch(`/admin/api/horarios?p=${pid}&d=${date}`)
      .then((r) => r.json())
      .then((s: { iso: string; time: string }[]) => {
        if (stale) return;
        setLoaded({ key, slots: s });
        setStart((cur) => (s.some((x) => x.iso === cur) ? cur : ""));
      })
      .catch(() => !stale && setLoaded({ key, slots: [] }));
    return () => {
      stale = true;
    };
  }, [pid, date]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="professionalId">
            Profissional<span className="text-red-600">*</span>
          </label>
          <select id="professionalId" name="professionalId" className="input" value={pid} onChange={(e) => setPid(e.target.value)} disabled={lockedProfessional}>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {lockedProfessional && <input type="hidden" name="professionalId" value={pid} />}
        </div>
        <div>
          <label className="label" htmlFor="date">
            Data<span className="text-red-600">*</span>
          </label>
          <input id="date" name="date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      <fieldset>
        <legend className="label">Horário{manual ? " (encaixe)" : " livre"}<span className="text-red-600">*</span></legend>
        {manual ? (
          <div className="flex flex-wrap items-center gap-3">
            <input name="time" type="time" className="input w-36" required step={300} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="force" defaultChecked className="size-4 accent-[var(--brand)]" /> Permitir sobreposição (encaixe)
            </label>
          </div>
        ) : slots === null ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Carregando horários…
          </p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted">Sem horários livres nesta data. Escolha outra data ou faça um encaixe.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {slots.map((s) => (
              <label key={s.iso} className="cursor-pointer rounded-lg border border-brand-200 bg-brand-50 py-2 text-center text-sm font-semibold text-brand-800 tabular-nums has-checked:border-brand has-checked:bg-brand has-checked:text-white">
                <input type="radio" name="start" value={s.iso} checked={start === s.iso} onChange={() => setStart(s.iso)} className="sr-only" required />
                {s.time}
              </label>
            ))}
          </div>
        )}
        <button type="button" className="mt-2 text-sm font-medium text-brand-700 hover:underline" onClick={() => setManual((m) => !m)}>
          {manual ? "← Voltar para horários livres" : "Fazer encaixe em outro horário"}
        </button>
      </fieldset>
      {pro && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="type">
              Tipo
            </label>
            <select id="type" name="type" className="input" key={pid}>
              {pro.inPerson && <option value="PRESENCIAL">Presencial</option>}
              {pro.telemedicine && <option value="TELECONSULTA">Teleconsulta</option>}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="insuranceId">
              Pagamento
            </label>
            <select id="insuranceId" name="insuranceId" className="input" key={`i${pid}`}>
              <option value="">Particular</option>
              {pro.insurances.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="price">
              Valor (R$)
            </label>
            <input id="price" name="price" className="input" inputMode="decimal" key={`p${pid}`} defaultValue={(pro.priceCents / 100).toFixed(2).replace(".", ",")} />
          </div>
        </div>
      )}
    </div>
  );
}
