"use client";

import { useState } from "react";
import { Plus, Trash2, Copy } from "lucide-react";

const WD = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
type Row = { weekday: number; startTime: string; endTime: string; unitId: string };

export function AvailabilityEditor({ initial, units }: { initial: Row[]; units: { id: string; name: string }[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const weekdays = () => {
    const tpl = rows[0] ?? { weekday: 1, startTime: "08:00", endTime: "12:00", unitId: "" };
    setRows([1, 2, 3, 4, 5].map((w) => ({ ...tpl, weekday: w })));
  };
  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-sm text-muted">Nenhuma faixa de atendimento. Sem faixas, o profissional não aparece com horários livres.</p>}
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2 sm:grid-cols-[1.2fr_1fr_1fr_1.4fr_auto]">
            <select name="av_weekday" aria-label="Dia da semana" className="input" value={r.weekday} onChange={(e) => set(i, { weekday: Number(e.target.value) })}>
              {WD.map((d, w) => (
                <option key={w} value={w}>
                  {d}
                </option>
              ))}
            </select>
            <input name="av_start" type="time" aria-label="Início" className="input" value={r.startTime} onChange={(e) => set(i, { startTime: e.target.value })} required />
            <input name="av_end" type="time" aria-label="Fim" className="input" value={r.endTime} onChange={(e) => set(i, { endTime: e.target.value })} required />
            <select name="av_unit" aria-label="Unidade" className="input" value={r.unitId} onChange={(e) => set(i, { unitId: e.target.value })}>
              <option value="">Unidade principal</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn-ghost btn-sm text-red-700" aria-label="Remover faixa" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              <Trash2 className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost btn-sm" onClick={() => setRows([...rows, rows[rows.length - 1] ? { ...rows[rows.length - 1]! } : { weekday: 1, startTime: "08:00", endTime: "12:00", unitId: "" }])}>
          <Plus className="size-4" aria-hidden /> Adicionar faixa
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={weekdays}>
          <Copy className="size-4" aria-hidden /> Repetir a 1ª faixa de segunda a sexta
        </button>
      </div>
    </div>
  );
}
