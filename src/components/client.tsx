"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useState, type ReactNode, type InputHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

export function SubmitButton({
  children,
  pendingText = "Salvando…",
  className = "btn-primary",
  name,
  value,
  confirm,
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  name?: string;
  value?: string;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden /> {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Campo com máscara leve (CPF / telefone) que não atrapalha colar ou apagar. */
export function MaskedInput({
  mask,
  defaultValue = "",
  ...props
}: { mask: "cpf" | "phone" } & InputHTMLAttributes<HTMLInputElement>) {
  const fn = mask === "cpf" ? maskCpf : maskPhone;
  const [value, setValue] = useState(fn(String(defaultValue ?? "")));
  return (
    <input
      {...props}
      inputMode="numeric"
      autoComplete={mask === "phone" ? "tel" : "off"}
      placeholder={mask === "cpf" ? "000.000.000-00" : "(11) 90000-0000"}
      value={value}
      onChange={(e) => setValue(fn(e.target.value))}
      className={props.className ?? "input"}
    />
  );
}

export function CookieBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do localStorage após montar
      setShow(!localStorage.getItem("cv_cookies"));
    } catch {
      setShow(true);
    }
  }, []);
  if (!show) return null;
  const choose = (v: string) => {
    try {
      localStorage.setItem("cv_cookies", v);
    } catch {}
    setShow(false);
  };
  return (
    <div role="region" aria-label="Aviso de cookies" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-line bg-white p-4 shadow-xl sm:flex sm:items-center sm:gap-4">
      <p className="text-sm text-foreground">
        Usamos cookies essenciais para o site funcionar e, com sua permissão, cookies de medição para melhorar sua experiência. Saiba mais na{" "}
        <a className="link" href="/privacidade">
          Política de Privacidade
        </a>
        .
      </p>
      <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
        <button className="btn-secondary btn-sm" onClick={() => choose("essenciais")}>
          Só essenciais
        </button>
        <button className="btn-primary btn-sm" onClick={() => choose("todos")}>
          Aceitar todos
        </button>
      </div>
    </div>
  );
}

export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button type="button" className="btn-primary no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text.startsWith("/") ? window.location.origin + text : text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {}
      }}
    >
      {done ? "Copiado ✓" : label}
    </button>
  );
}
