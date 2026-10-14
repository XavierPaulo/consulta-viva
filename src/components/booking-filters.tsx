"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useState } from "react";
import { Search, X, Loader2, SlidersHorizontal } from "lucide-react";

type Opt = { value: string; label: string };

export function BookingFilters({
  specialties,
  professionals,
  units,
  insurances,
  minDate,
}: {
  specialties: Opt[];
  professionals: Opt[];
  units: Opt[];
  insurances: Opt[];
  minDate: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(false);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  const val = (k: string) => params.get(k) ?? "";
  const active = ["q", "especialidade", "medico", "unidade", "data", "turno", "convenio", "tipo"].some((k) => params.get(k));

  const select = (k: string, label: string, opts: Opt[], all: string) => (
    <div>
      <label htmlFor={`f-${k}`} className="label">
        {label}
      </label>
      <select id={`f-${k}`} className="input" value={val(k)} onChange={(e) => update({ [k]: e.target.value })}>
        <option value="">{all}</option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="card p-4 sm:p-5">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q });
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="f-q" className="sr-only">
            Buscar por especialidade, médico ou sintoma
          </label>
          <input id="f-q" className="input pl-10" placeholder="Especialidade, médico ou sintoma" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn-primary">Buscar</button>
      </form>
      <button type="button" className="btn-secondary btn-sm mt-3 md:hidden" aria-expanded={open} aria-controls="filtros" onClick={() => setOpen((o) => !o)}>
        <SlidersHorizontal className="size-4" aria-hidden /> {open ? "Esconder filtros" : "Filtros (especialidade, data, turno…)"}
      </button>
      <div id="filtros" className={`mt-4 gap-3 sm:grid-cols-2 md:grid lg:grid-cols-4 ${open ? "grid" : "hidden"}`}>
        {select("especialidade", "Especialidade", specialties, "Todas")}
        {select("medico", "Médico(a)", professionals, "Todos")}
        {select("unidade", "Unidade", units, "Todas")}
        {select("convenio", "Convênio", [{ value: "particular", label: "Particular (sem convênio)" }, ...insurances], "Particular ou convênio")}
        <div>
          <label htmlFor="f-data" className="label">
            A partir de
          </label>
          <input id="f-data" type="date" className="input" min={minDate} value={val("data") || minDate} onChange={(e) => update({ data: e.target.value })} />
        </div>
        <fieldset className="sm:col-span-1 lg:col-span-2">
          <legend className="label">Turno</legend>
          <div className="flex flex-wrap gap-2">
            {[
              ["", "Qualquer"],
              ["MANHA", "Manhã"],
              ["TARDE", "Tarde"],
              ["NOITE", "Noite"],
            ].map(([v, l]) => (
              <button key={v} type="button" className="chip" aria-pressed={val("turno") === v} onClick={() => update({ turno: v! })}>
                {l}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">Tipo de consulta</legend>
          <div className="flex flex-wrap gap-2">
            {[
              ["", "Ambos"],
              ["PRESENCIAL", "Presencial"],
              ["TELECONSULTA", "Online"],
            ].map(([v, l]) => (
              <button key={v} type="button" className="chip" aria-pressed={val("tipo") === v} onClick={() => update({ tipo: v! })}>
                {l}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="mt-3 flex min-h-6 items-center gap-3 text-sm text-muted" aria-live="polite">
        {pending && (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Atualizando horários…
          </span>
        )}
        {active && !pending && (
          <button
            type="button"
            className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
            onClick={() => {
              setQ("");
              start(() => router.replace(pathname, { scroll: false }));
            }}
          >
            <X className="size-4" aria-hidden /> Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
