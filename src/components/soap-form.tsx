"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type Item = { medication: string; dosage: string; instructions: string };

const SOAP = [
  { key: "subjective", label: "S – Subjetivo", hint: "Queixa principal, história, o que o paciente relata." },
  { key: "objective", label: "O – Objetivo", hint: "Exame físico, sinais vitais, resultados de exames." },
  { key: "assessment", label: "A – Avaliação", hint: "Hipóteses diagnósticas, CID se aplicável." },
  { key: "plan", label: "P – Plano", hint: "Conduta, exames solicitados, orientações e retorno." },
] as const;

export function SoapFields({ defaults, readOnly }: { defaults?: Partial<Record<(typeof SOAP)[number]["key"], string>> & { items?: Item[] }; readOnly?: boolean }) {
  const [items, setItems] = useState<Item[]>(defaults?.items?.length ? defaults.items : []);
  return (
    <div className="space-y-5">
      {SOAP.map((s) => (
        <div key={s.key}>
          <label htmlFor={s.key} className="label">
            {s.label}
          </label>
          <textarea id={s.key} name={s.key} defaultValue={defaults?.[s.key] ?? ""} rows={s.key === "subjective" ? 4 : 3} className="input" readOnly={readOnly} placeholder={s.hint} />
        </div>
      ))}
      <fieldset className="rounded-2xl border border-line p-4">
        <legend className="px-1 font-semibold">Prescrição</legend>
        {items.length === 0 && <p className="text-sm text-muted">Nenhum medicamento prescrito.</p>}
        <ul className="space-y-3">
          {items.map((it, i) => (
            <li key={i} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1.4fr_1fr_auto]">
              <input name="medication" aria-label={`Medicamento ${i + 1}`} placeholder="Medicamento e concentração" className="input" defaultValue={it.medication} readOnly={readOnly} required />
              <input name="dosage" aria-label={`Posologia ${i + 1}`} placeholder="Posologia (ex.: 1 cp 8/8h)" className="input" defaultValue={it.dosage} readOnly={readOnly} />
              {!readOnly && (
                <button type="button" className="btn-ghost btn-sm text-red-700" aria-label={`Remover item ${i + 1}`} onClick={() => setItems(items.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
              <input name="instructions" aria-label={`Orientações ${i + 1}`} placeholder="Orientações (ex.: por 7 dias, após as refeições)" className="input sm:col-span-3" defaultValue={it.instructions} readOnly={readOnly} />
            </li>
          ))}
        </ul>
        {!readOnly && (
          <button type="button" className="btn-ghost btn-sm mt-3" onClick={() => setItems([...items, { medication: "", dosage: "", instructions: "" }])}>
            <Plus className="size-4" aria-hidden /> Adicionar medicamento
          </button>
        )}
      </fieldset>
    </div>
  );
}
