import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/client";
import { requestReset } from "../auth-actions";
import { AuthShell } from "../auth-shell";

export const metadata = { title: "Recuperar senha" };

export default function Page() {
  return (
    <AuthShell title="Recuperar senha" subtitle="Enviaremos um link para você criar uma nova senha.">
      <ActionForm action={requestReset} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">
            E-mail cadastrado
          </label>
          <input id="email" name="email" type="email" autoComplete="username" required autoFocus className="input" />
        </div>
        <SubmitButton className="btn-primary w-full" pendingText="Enviando…">
          Enviar link
        </SubmitButton>
        <Link href="/admin/login" className="block text-center text-sm font-medium text-brand-700 hover:underline">
          Voltar para o login
        </Link>
      </ActionForm>
    </AuthShell>
  );
}
