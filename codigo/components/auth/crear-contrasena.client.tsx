"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { InputPassword } from "@/components/ui/input-password.client";
import { createClient } from "@/shared/lib/supabase/client";

// Canje del token de recovery + creación de la contraseña (STORY-955).
// Cliente browser SOLO para auth.* (ARQUITECTURA): verifyOtp abre la sesión
// y updateUser guarda la contraseña nueva.
export function CrearContrasenaForm({ tokenHash }: { tokenHash: string | null }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"canjeando" | "listo" | "vencido">(
    tokenHash ? "canjeando" : "vencido"
  );
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!tokenHash) return;
    const supabase = createClient();
    supabase.auth
      .verifyOtp({ type: "recovery", token_hash: tokenHash })
      .then(({ error }) => setEstado(error ? "vencido" : "listo"));
  }, [tokenHash]);

  if (estado === "canjeando") {
    return <p className="text-[15px] text-muted">Verificando el link…</p>;
  }

  if (estado === "vencido") {
    return (
      <div>
        <p
          role="alert"
          className="text-sm font-medium rounded-md px-4 py-3 border text-error bg-error-soft border-error-soft-border"
        >
          El link ya se usó o venció.
        </p>
        <p className="mt-4 text-sm text-muted">
          Pedí uno nuevo desde{" "}
          <Link
            href="/recuperar-contrasena"
            className="font-medium text-brand hover:text-brand-hover"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password.length < 8) {
      return setError("La contraseña debe tener al menos 8 caracteres.");
    }
    setEnviando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      // "same_password": vino por recovery y eligió la contraseña que ya
      // tenía — GoTrue la rechaza y el mensaje genérico confundía.
      setError(
        error.code === "same_password"
          ? "Esa ya es tu contraseña actual — elegí una distinta, o entrá directamente con ella."
          : "No se pudo guardar la contraseña. Probá de nuevo."
      );
      setEnviando(false);
      return;
    }
    router.replace("/panel");
  }

  return (
    <form className="flex flex-col gap-7" onSubmit={onSubmit}>
      <InputPassword
        label="Contraseña nueva"
        variante="editorial"
        name="password"
        placeholder="Mínimo 8 caracteres"
        autoComplete="new-password"
        minLength={8}
        required
      />
      {error && (
        <p role="alert" className="text-sm font-medium text-error -my-2">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="w-full sm:w-auto sm:self-start sm:px-10"
        disabled={enviando}
      >
        {enviando ? "Guardando…" : "Guardar y entrar"}
      </Button>
    </form>
  );
}
