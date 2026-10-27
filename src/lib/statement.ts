import { localToDate } from "./format";

export type ParsedLine = { date: Date; description: string; amountCents: number };

/** "1.234,56" | "1234.56" | "-12,30" | "R$ 150,00" → centavos */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[R$\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** "27/10/2026" | "2026-10-27" | "27/10/26" → Date (meia-noite de Brasília) */
export function parseDate(raw: string): Date | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return localToDate(`${m[1]}-${m[2]}-${m[3]}`);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const y = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    return localToDate(`${y}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`);
  }
  return null;
}

function splitCsvLine(line: string, sep: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === sep && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/**
 * Extrato em CSV (o que a maioria dos bancos exporta): procura em cada linha uma data, um valor e uma descrição.
 * Aceita ; ou , como separador e ignora o cabeçalho.
 */
export function parseCsv(text: string): ParsedLine[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = (lines[0]!.match(/;/g)?.length ?? 0) >= (lines[0]!.match(/,/g)?.length ?? 0) ? ";" : ",";
  const out: ParsedLine[] = [];
  for (const line of lines) {
    const cols = splitCsvLine(line, sep);
    const dateIdx = cols.findIndex((c) => parseDate(c));
    if (dateIdx < 0) continue;
    // valor: última coluna numérica que não seja a data
    let amountIdx = -1;
    for (let i = cols.length - 1; i >= 0; i--) {
      if (i !== dateIdx && /\d/.test(cols[i]!) && /^[-+(R$\s\d.,)]+$/.test(cols[i]!) && parseAmount(cols[i]!) !== null) {
        amountIdx = i;
        break;
      }
    }
    if (amountIdx < 0) continue;
    const description = cols.filter((_, i) => i !== dateIdx && i !== amountIdx && !/^[-+\d.,\s]*$/.test(cols[i]!)).join(" ").trim();
    out.push({ date: parseDate(cols[dateIdx]!)!, description: description || "Lançamento", amountCents: parseAmount(cols[amountIdx]!)! });
  }
  return out;
}

/** Extrato OFX (padrão de muitos bancos brasileiros). */
export function parseOfx(text: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  const tag = (block: string, name: string) => block.match(new RegExp(`<${name}>([^<\\r\\n]+)`, "i"))?.[1]?.trim() ?? "";
  for (const block of text.split(/<STMTTRN>/i).slice(1)) {
    const dt = tag(block, "DTPOSTED");
    const amount = parseAmount(tag(block, "TRNAMT"));
    if (!/^\d{8}/.test(dt) || amount === null) continue;
    out.push({
      date: localToDate(`${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`),
      description: tag(block, "MEMO") || tag(block, "NAME") || "Lançamento",
      amountCents: amount,
    });
  }
  return out;
}

export function parseStatement(text: string): ParsedLine[] {
  return /<OFX>|<STMTTRN>/i.test(text) ? parseOfx(text) : parseCsv(text);
}

// ---- conciliação ----

export type MatchPayment = { id: string; amountCents: number; method: string; paidAt: Date | null; feeBp: number };

/** Dias de prazo de recebimento por forma de pagamento (crédito cai em até ~30 dias). */
const SETTLEMENT_DAYS: Record<string, number> = { CREDITO: 35, DEBITO: 4, PIX: 2, LINK: 35, BOLETO: 4, DINHEIRO: 3, CONVENIO: 60 };

/**
 * Nota de 0 a 100 de quanto uma linha do extrato parece ser um pagamento: valor exato ou valor menos a taxa
 * esperada, e data dentro do prazo de recebimento da forma de pagamento.
 */
export function matchScore(line: { date: Date; amountCents: number }, p: MatchPayment) {
  if (!p.paidAt || line.amountCents <= 0) return 0;
  const days = (line.date.getTime() - p.paidAt.getTime()) / 86400_000;
  const maxDays = SETTLEMENT_DAYS[p.method] ?? 5;
  if (days < -1.5 || days > maxDays) return 0;
  const expectedNet = Math.round(p.amountCents * (1 - p.feeBp / 10_000));
  let score: number;
  if (line.amountCents === p.amountCents) score = 90;
  else if (Math.abs(line.amountCents - expectedNet) <= 2) score = 85;
  else if (line.amountCents < p.amountCents && line.amountCents >= p.amountCents * 0.9) score = 50; // taxa diferente da configurada
  else return 0;
  return score - Math.min(20, Math.abs(days)) / 2;
}

/** Taxa esperada (centésimos de %) para a forma de pagamento, conforme Configurações › Financeiro. */
export function feeBpFor(clinic: { feeCreditBp: number; feeDebitBp: number; feePixBp: number }, method: string) {
  if (method === "CREDITO") return clinic.feeCreditBp;
  if (method === "DEBITO") return clinic.feeDebitBp;
  if (method === "PIX" || method === "LINK") return clinic.feePixBp;
  return 0;
}
