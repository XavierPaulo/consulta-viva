import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/client";
import { Notice } from "@/components/ui";
import { login } from "../auth-actions";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect("/admin");
  return (
    <AuthShell title="Acesso da equipe" subtitle="Entre com seu e-mail e senha.">
      <div className="space-y-4">
        {sp.expirada && <Notice tone="info">Sua sessão expirou por inatividade. Entre novamente.</Notice>}
        {sp.saiu && <Notice tone="success">Você saiu com segurança.</Notice>}
        {sp.senha && <Notice tone="success">Senha alterada. Entre com a nova senha.</Notice>}
        <ActionForm action={login} className="space-y-4">
          <input type="hidden" name="voltar" value={typeof sp.voltar === "string" ? sp.voltar : ""} />
          <div>
            <label htmlFor="email" className="label">
              E-mail
            </label>
            <input id="email" name="email" type="email" autoComplete="username" required autoFocus className="input" />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="password" className="label">
                Senha
              </label>
              <Link href="/admin/recuperar" className="text-sm font-medium text-brand-700 hover:underline">
                Esqueci a senha
              </Link>
            </div>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>
          <SubmitButton className="btn-primary w-full" pendingText="Entrando…">
            Entrar
          </SubmitButton>
        </ActionForm>
        <button type="button" disabled className="btn-secondary w-full" title="Disponível quando o provedor de SSO for configurado">
          Entrar com SSO (Google / Microsoft) — em breve
        </button>
      </div>
    </AuthShell>
  );
}
