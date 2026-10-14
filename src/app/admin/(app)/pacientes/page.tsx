import Link from "next/link";
import { Search, UserPlus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { fmtDate, formatCpf, formatPhone, onlyDigits } from "@/lib/format";
import { Avatar, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Pacientes" };

export default async function Pacientes({ searchParams }: PageProps<"/admin/pacientes">) {
  const sp = await searchParams;
  const user = await requireUser("pacientes");
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const digits = onlyDigits(q);
  const patients = await prisma.patient.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { email: { contains: q.toLowerCase() } }, ...(digits.length >= 3 ? [{ cpf: { contains: digits } }, { phone: { contains: digits } }] : [])] }
      : {},
    orderBy: { name: "asc" },
    take: 100,
    include: { appointments: { orderBy: { start: "desc" }, take: 1, select: { start: true } } },
  });
  return (
    <>
      <PageHeader
        title="Pacientes"
        actions={
          can(user, "pacientes", "create") && (
            <Link href="/admin/pacientes/novo" className="btn-primary">
              <UserPlus className="size-4" aria-hidden /> Novo paciente
            </Link>
          )
        }
      />
      <form className="relative mb-5 max-w-xl" role="search">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="q" className="sr-only">
          Buscar paciente
        </label>
        <input id="q" name="q" defaultValue={q} placeholder="Buscar por nome, CPF, telefone ou e-mail" className="input pl-10" autoFocus />
      </form>
      {patients.length === 0 ? (
        <EmptyState title={q ? `Nenhum paciente para “${q}”` : "Nenhum paciente cadastrado"} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>CPF</th>
                <th>Telefone</th>
                <th>Última consulta</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td>
                    <Link href={`/admin/pacientes/${p.id}`} className="flex items-center gap-3 font-medium hover:underline">
                      <Avatar name={p.name} size={32} /> {p.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap text-muted">{formatCpf(p.cpf) || "—"}</td>
                  <td className="whitespace-nowrap text-muted">{formatPhone(p.phone)}</td>
                  <td className="whitespace-nowrap text-muted">{p.appointments[0] ? fmtDate(p.appointments[0].start) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
