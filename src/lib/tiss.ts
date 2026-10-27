import { createHash } from "node:crypto";
import { onlyDigits } from "./format";

/**
 * Geração de lote de Guias de Consulta no Padrão TISS 4.01.00 (ANS), estrutura conforme
 * tissV4_01_00.xsd: mensagemTISS → cabecalho → prestadorParaOperadora → loteGuias → guiaConsulta.
 * O hash do epílogo é o MD5 do conteúdo de todos os campos, na ordem, codificado em ISO-8859-1.
 * Antes de enviar, valide o arquivo no portal da operadora (cada operadora pode exigir campos opcionais).
 */

// Código IBGE da UF usado pela TISS (dm_UF)
const UF_CODE: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17", MA: "21", PI: "22", CE: "23", RN: "24", PB: "25",
  PE: "26", AL: "27", SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41", SC: "42", RS: "43", MS: "50",
  MT: "51", GO: "52", DF: "53",
};

export type TissGuide = {
  guideNumber: string; // nº da guia no prestador
  operatorGuide?: string; // nº da guia na operadora / senha de autorização
  cardNumber: string; // carteirinha
  date: Date;
  firstVisit: boolean;
  valueCents: number;
  professional: { name: string; crm: string; crmUf: string; cbo: string };
  tussCode: string;
  tableCode: string;
  notes?: string;
};

export type TissBatchInput = {
  batchNumber: number;
  sequence: number;
  createdAt: Date;
  version: string;
  ansCode: string; // registro ANS da operadora
  providerCode: string; // código da clínica na operadora
  cnes: string;
  guides: TissGuide[];
};

/** Dados da clínica/operadora que faltam para gerar qualquer guia (mensagens prontas para a tela). */
export function tissProblems(input: { ansCode: string; providerCode: string; cnes: string }, guide?: Pick<TissGuide, "cardNumber" | "professional">) {
  const p: string[] = [];
  if (!/^\d{6}$/.test(input.ansCode)) p.push("Registro ANS da operadora (Configurações › Convênios)");
  if (!input.providerCode) p.push("Código da clínica na operadora (Configurações › Convênios)");
  if (!/^\d{7}$/.test(input.cnes)) p.push("CNES da clínica (Configurações › Financeiro)");
  if (guide) p.push(...guideProblems(guide));
  return p;
}

/** O que falta em uma consulta específica para virar guia. */
export function guideProblems(guide: Pick<TissGuide, "cardNumber" | "professional">) {
  const p: string[] = [];
  if (!guide.cardNumber) p.push("carteirinha do paciente");
  if (!guide.professional.crm) p.push("CRM do profissional");
  if (!UF_CODE[guide.professional.crmUf.toUpperCase()]) p.push("UF do CRM do profissional");
  return p;
}

type Node = [string, string | Node[]];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cut = (s: string, n: number) => s.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, n);
const dateIso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
const timeIso = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(d);
const money = (cents: number) => (cents / 100).toFixed(2);

function guideNode(b: TissBatchInput, g: TissGuide): Node {
  const nodes: Node[] = [
    ["cabecalhoConsulta", [["registroANS", b.ansCode], ["numeroGuiaPrestador", cut(g.guideNumber, 20)]]],
  ];
  if (g.operatorGuide) nodes.push(["numeroGuiaOperadora", cut(g.operatorGuide, 20)]);
  nodes.push(
    ["dadosBeneficiario", [["numeroCarteira", cut(g.cardNumber, 20)], ["atendimentoRN", "N"]]],
    ["contratadoExecutante", [["codigoPrestadorNaOperadora", cut(b.providerCode, 14)], ["CNES", b.cnes]]],
    [
      "profissionalExecutante",
      [
        ["nomeProfissional", cut(g.professional.name, 70)],
        ["conselhoProfissional", "06"], // CRM
        ["numeroConselhoProfissional", cut(onlyDigits(g.professional.crm), 15)],
        ["UF", UF_CODE[g.professional.crmUf.toUpperCase()] ?? "35"],
        ["CBOS", g.professional.cbo],
      ],
    ],
    ["indicacaoAcidente", "9"], // não acidente
    [
      "dadosAtendimento",
      [
        ["regimeAtendimento", "01"], // ambulatorial
        ["dataAtendimento", dateIso(g.date)],
        ["tipoConsulta", g.firstVisit ? "1" : "2"],
        ["procedimento", [["codigoTabela", g.tableCode], ["codigoProcedimento", g.tussCode], ["valorProcedimento", money(g.valueCents)]]],
      ],
    ],
  );
  if (g.notes) nodes.push(["observacao", cut(g.notes, 500)]);
  return ["guiaConsulta", nodes];
}

function render(node: Node, depth: number, texts: string[]): string {
  const [name, value] = node;
  const pad = "  ".repeat(depth);
  if (typeof value === "string") {
    texts.push(value);
    return `${pad}<ans:${name}>${esc(value)}</ans:${name}>`;
  }
  return `${pad}<ans:${name}>\n${value.map((n) => render(n, depth + 1, texts)).join("\n")}\n${pad}</ans:${name}>`;
}

/** Monta o XML do lote. Devolve o texto (para baixar em ISO-8859-1) e o hash do epílogo. */
export function buildTissBatchXml(b: TissBatchInput) {
  const body: Node[] = [
    [
      "cabecalho",
      [
        [
          "identificacaoTransacao",
          [
            ["tipoTransacao", "ENVIO_LOTE_GUIAS"],
            ["sequencialTransacao", String(b.sequence)],
            ["dataRegistroTransacao", dateIso(b.createdAt)],
            ["horaRegistroTransacao", timeIso(b.createdAt)],
          ],
        ],
        ["origem", [["identificacaoPrestador", [["codigoPrestadorNaOperadora", cut(b.providerCode, 14)]]]]],
        ["destino", [["registroANS", b.ansCode]]],
        ["Padrao", b.version],
      ],
    ],
    [
      "prestadorParaOperadora",
      [["loteGuias", [["numeroLote", String(b.batchNumber)], ["guiasTISS", b.guides.map((g) => guideNode(b, g))]]]],
    ],
  ];
  const texts: string[] = [];
  const inner = body.map((n) => render(n, 1, texts)).join("\n");
  const hash = createHash("md5").update(Buffer.from(texts.join(""), "latin1")).digest("hex");
  const xml =
    `<?xml version="1.0" encoding="ISO-8859-1"?>\n` +
    `<ans:mensagemTISS xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xsi:schemaLocation="http://www.ans.gov.br/padroes/tiss/schemas http://www.ans.gov.br/padroes/tiss/schemas/tissV${b.version.replace(/\./g, "_")}.xsd">\n` +
    `${inner}\n  <ans:epilogo>\n    <ans:hash>${hash}</ans:hash>\n  </ans:epilogo>\n</ans:mensagemTISS>\n`;
  return { xml, hash };
}
