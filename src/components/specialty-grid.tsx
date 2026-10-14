"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SpecialtyIconClient } from "./specialty-icon-client";
import { SPECIALTY_TONE, TONE } from "./tones";

type Item = { id: string; name: string; slug: string; description: string; symptoms: string; icon: string; doctors: number; tele: boolean };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function SpecialtyGrid({ items }: { items: Item[] }) {
  const [q, setQ] = useState("");
  const [tele, setTele] = useState(false);
  const list = useMemo(
    () =>
      items.filter((s) => {
        if (tele && !s.tele) return false;
        if (!q) return true;
        const hay = norm(`${s.name} ${s.description} ${s.symptoms}`);
        return norm(q)
          .split(/\s+/)
          .every((w) => hay.includes(w));
      }),
    [items, q, tele],
  );
  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="busca-esp" className="sr-only">
            Filtrar especialidades
          </label>
          <input
            id="busca-esp"
            className="input pl-10"
            placeholder="Filtre por especialidade ou sintoma (ex.: dor nas costas)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button type="button" className="chip" aria-pressed={tele} onClick={() => setTele((v) => !v)}>
          Com teleconsulta
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {list.length} especialidades encontradas
      </p>
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-muted">
          Nenhuma especialidade encontrada para “{q}”. Tente outra palavra ou{" "}
          <Link className="link" href="/agendar">
            veja todos os horários
          </Link>
          .
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((s) => (
            <li key={s.id}>
              <Link
                href={`/agendar?especialidade=${s.slug}`}
                className="card group flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
              >
                <span className={`grid size-11 place-items-center rounded-xl ring-1 ring-inset transition group-hover:scale-105 ${TONE[SPECIALTY_TONE[s.icon] ?? "teal"].chip}`}>
                  <SpecialtyIconClient name={s.icon} />
                </span>
                <span className="mt-3 font-semibold">{s.name}</span>
                <span className="mt-1 line-clamp-2 flex-1 text-sm text-muted">{s.description}</span>
                <span className="mt-3 text-sm font-medium text-brand-700">
                  {s.doctors} {s.doctors === 1 ? "profissional" : "profissionais"} · Agendar →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
