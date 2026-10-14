import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/client";
import { resetPassword } from "../../auth-actions";
import { AuthShell } from "../../auth-shell";

export const metadata = { title: "Nova senha" };

export default async function Page({ params }: PageProps<"/admin/redefinir/[token]">) {
  const { token } = await params;
  return (
    <AuthShell title="Criar nova senha" subtitle="Use pelo menos 8 caracteres, com letras e números.">
      <ActionForm action={resetPassword.bind(null, token)} className="space-y-4">
        <div>
          <label htmlFor="password" className="label">
            Nova senha
          </label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
        </div>
        <div>
          <label htmlFor="confirm" className="label">
            Repita a nova senha
          </label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="input" />
        </div>
        <SubmitButton className="btn-primary w-full">Salvar nova senha</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
