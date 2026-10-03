"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { Notice } from "./ui";

export type ActionState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> };

/** Formulário que mostra erros/sucesso de uma server action sem perder o que foi digitado. */
export function ActionForm({
  action,
  children,
  className = "space-y-5",
  resetOnSuccess = false,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {state.error && (
        <Notice tone="error">
          {state.error}
          {state.fieldErrors && (
            <ul className="mt-1 list-disc pl-5 text-sm">
              {Object.values(state.fieldErrors).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
      {state.ok && state.message && <Notice tone="success">{state.message}</Notice>}
      {children}
    </form>
  );
}
