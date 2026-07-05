"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/shared/lib/supabase/client";

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
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <Input
        label="Correo electrónico"
        type="email"
        name="email"
        placeholder="nombre@inmobiliaria.com"
        autoComplete="email"
        required
      />
      <Input
        label="Contraseña"
        type="password"
        name="password"
        placeholder="••••••••"
        autoComplete="current-password"
        required
      />
      {error && (
        <p
          role="alert"
          className="text-sm font-medium text-alerta-600 bg-alerta-100 border border-alerta-600/30 rounded-caja px-3.5 py-2.5"
        >
          {error}
        </p>
      )}
      <Button type="submit" className="mt-1 w-full" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar al sistema"}
      </Button>
    </form>
  );
}
