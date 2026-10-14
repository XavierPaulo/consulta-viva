import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { brl } from "@/lib/format";
import { Avatar, Badge, PageHeader } from "@/components/ui";

export const metadata = { title: "Profissionais" };

export default async function Profissionais() {
  const user = await requireUser("profissionais");
  const pros = await prisma.professional.findMany({ orderBy: { name: "asc" }, include: { specialties: true, unit: true, user: true } });
  return (
    <>
      <PageHeader
        title="Profissionais"
        description="Cadastro, página pública, especialidades e grade de atendimento."
        actions={
          can(user, "profissionais", "create") && (
            <Link href="/admin/profissionais/novo" className="btn-primary">
              <Plus className="size-4" aria-hidden /> Novo profissional
            </Link>
          )
        }
      />
      <ul className="grid gap-3 md:grid-cols-2">
        {pros.map((p) => (
          <li key={p.id}>
            <Link href={`/admin/profissionais/${p.id}`} className="card flex items-center gap-4 p-4 transition hover:border-brand-200">
              <Avatar name={p.name} url={p.photoUrl} size={52} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {p.title} {p.name}
                </span>
                <span className="block text-sm text-muted">
                  CRM {p.crm}/{p.crmUf} · {p.specialties.map((s) => s.name).join(", ")}
                </span>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {p.published ? <Badge tone="green">Publicado</Badge> : <Badge>Oculto no site</Badge>}
                  {p.unit && <Badge>{p.unit.name}</Badge>}
                  {p.user ? <Badge tone="teal">Com acesso</Badge> : <Badge tone="amber">Sem login</Badge>}
                  <Badge>{brl(p.priceCents)}</Badge>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
