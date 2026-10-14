// Paleta de cores por categoria: cada módulo/especialidade tem uma cor própria,
// para o olho reconhecer o item antes de ler o texto. Classes escritas por extenso para o Tailwind.
export const TONE = {
  teal: { chip: "bg-teal-50 text-teal-700 ring-teal-100", solid: "bg-teal-600", text: "text-teal-700" },
  sky: { chip: "bg-sky-50 text-sky-700 ring-sky-100", solid: "bg-sky-600", text: "text-sky-700" },
  violet: { chip: "bg-violet-50 text-violet-700 ring-violet-100", solid: "bg-violet-600", text: "text-violet-700" },
  emerald: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-100", solid: "bg-emerald-600", text: "text-emerald-700" },
  amber: { chip: "bg-amber-50 text-amber-700 ring-amber-100", solid: "bg-amber-500", text: "text-amber-700" },
  rose: { chip: "bg-rose-50 text-rose-700 ring-rose-100", solid: "bg-rose-600", text: "text-rose-700" },
  indigo: { chip: "bg-indigo-50 text-indigo-700 ring-indigo-100", solid: "bg-indigo-600", text: "text-indigo-700" },
  slate: { chip: "bg-slate-100 text-slate-700 ring-slate-200", solid: "bg-slate-600", text: "text-slate-700" },
  cyan: { chip: "bg-cyan-50 text-cyan-700 ring-cyan-100", solid: "bg-cyan-600", text: "text-cyan-700" },
  orange: { chip: "bg-orange-50 text-orange-700 ring-orange-100", solid: "bg-orange-500", text: "text-orange-700" },
  pink: { chip: "bg-pink-50 text-pink-700 ring-pink-100", solid: "bg-pink-600", text: "text-pink-700" },
  red: { chip: "bg-red-50 text-red-700 ring-red-100", solid: "bg-red-600", text: "text-red-700" },
} as const;
export type Tone = keyof typeof TONE;

/** Cor fixa de cada módulo da área interna (menu, painel e atalhos usam a mesma). */
export const MODULE_TONE: Record<string, Tone> = {
  dashboard: "teal",
  agenda: "sky",
  pacientes: "violet",
  financeiro: "emerald",
  mensagens: "amber",
  profissionais: "rose",
  relatorios: "indigo",
  configuracoes: "slate",
  usuarios: "cyan",
  auditoria: "orange",
};

/** Cor de cada ícone de especialidade. */
export const SPECIALTY_TONE: Record<string, Tone> = {
  stethoscope: "teal",
  heart: "red",
  sparkles: "amber",
  baby: "sky",
  flower: "pink",
  bone: "orange",
  brain: "violet",
  activity: "emerald",
  eye: "cyan",
  smile: "indigo",
};
