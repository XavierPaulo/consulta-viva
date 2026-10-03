import { cache } from "react";
import { prisma } from "./db";
import { PUBLIC_SECTIONS, type SectionKey } from "./constants";
import { parseJson } from "./format";

export const getClinic = cache(async () => {
  const clinic =
    (await prisma.clinic.findUnique({ where: { id: "clinic" } })) ??
    (await prisma.clinic.create({ data: { id: "clinic", name: "Minha Clínica" } }));
  return {
    ...clinic,
    paymentMethodList: parseJson<string[]>(clinic.paymentMethods, []),
    hiddenList: parseJson<string[]>(clinic.hiddenSections, []),
  };
});

export type ClinicData = Awaited<ReturnType<typeof getClinic>>;

/**
 * Seções obrigatórias (*) sempre aparecem. As opcionais aparecem quando têm conteúdo
 * e não foram marcadas como "ocultar" nas Configurações.
 */
export function sectionVisible(clinic: ClinicData, key: SectionKey, hasContent = true) {
  const def = PUBLIC_SECTIONS.find((s) => s.key === key);
  if (def?.required) return true;
  return hasContent && !clinic.hiddenList.includes(key);
}
