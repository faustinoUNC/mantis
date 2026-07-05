"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/shared/lib/supabase/client";

function CampoEditorial({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={props.name}
        className="text-[13px] font-medium text-muted"
      >
        {label}
      </label>
      <input id={props.name} className="input-editorial" {...props} />
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    if (error) {
      setError("Correo o contraseña incorrectos.");
      setEnviando(false);
      return;
    }
    router.replace("/panel");
  }

  return (
    <form className="flex flex-col gap-7" onSubmit={onSubmit}>
      <CampoEditorial
        label="Correo electrónico"
        type="email"
        name="email"
        placeholder="nombre@inmobiliaria.com"
        autoComplete="email"
        required
      />
      <CampoEditorial
        label="Contraseña"
        type="password"
        name="password"
        placeholder="••••••••"
        autoComplete="current-password"
        required
      />
      {error && (
        <p role="alert" className="text-sm font-medium text-error -my-2">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full sm:w-auto sm:self-start sm:px-10" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar al sistema"}
      </Button>
    </form>
  );
}
