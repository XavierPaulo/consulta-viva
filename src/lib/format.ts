export const TZ = "America/Sao_Paulo";
// O Brasil não tem horário de verão desde 2019: o fuso da clínica é fixo em -03:00.
export const TZ_OFFSET = "-03:00";

export function brl(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function parseMoney(input: FormDataEntryValue | null): number {
  const s = String(input ?? "").replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  // aceita "1.234,56", "1234,56" e "1234.56"
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function centsToInput(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toFixed(2).replace(".", ",");
}

export function onlyDigits(s: string | null | undefined) {
  return String(s ?? "").replace(/\D/g, "");
}

export function formatCpf(cpf: string | null | undefined) {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return cpf ?? "";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function isValidCpf(cpf: string) {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function formatPhone(phone: string | null | undefined) {
  const d = onlyDigits(phone);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone ?? "";
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...opts });

export const fmtDate = (d: Date) => fmt({ day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
export const fmtTime = (d: Date) => fmt({ hour: "2-digit", minute: "2-digit" }).format(d);
export const fmtDateTime = (d: Date) => `${fmtDate(d)} às ${fmtTime(d)}`;
export const fmtLongDate = (d: Date) => {
  const s = fmt({ weekday: "long", day: "numeric", month: "long" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const fmtWeekdayShort = (d: Date) => fmt({ weekday: "short" }).format(d).replace(".", "");

/** "YYYY-MM-DD" da data no fuso da clínica */
export function ymd(d: Date) {
  const p = fmt({ year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Hora "HH:MM" no fuso da clínica */
export function hm(d: Date) {
  return fmtTime(d);
}

/** Converte data "YYYY-MM-DD" + hora "HH:MM" (horário da clínica) em Date */
export function localToDate(day: string, time = "00:00") {
  return new Date(`${day}T${time}:00${TZ_OFFSET}`);
}

export function addDays(day: string, n: number) {
  const d = localToDate(day, "12:00");
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}

export function weekdayOf(day: string) {
  return localToDate(day, "12:00").getUTCDay();
}

export function todayYmd() {
  return ymd(new Date());
}

export function initials(name: string) {
  return name
    .replace(/^(dr|dra|dr\(a\))\.?\s+/i, "")
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Instante atual (servidor). Isolado para deixar explícito que a página depende da hora. */
export const now = () => Date.now();
