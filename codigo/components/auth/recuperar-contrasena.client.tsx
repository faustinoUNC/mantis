"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { recuperarContrasena } from "@/features/auth/service";

// "¿Olvidaste tu contraseña?" (STORY-955). La respuesta es siempre la misma,
// exista o no el email (anti-enumeración) — el server ya lo garantiza.
export function RecuperarContrasenaForm() {
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  if (enviado) {
    return (
      <p className="text-[15px] text-muted max-w-sm leading-relaxed">
        Si ese correo tiene una cuenta, te acabamos de mandar un email con el
        link para crear una contraseña nueva. Revisá tu casilla.
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    const form = new FormData(e.currentTarget);
    await recuperarContrasena(String(form.get("email")));
    setEnviado(true);
  }

  return (
    <form className="flex flex-col gap-7" onSubmit={onSubmit}>
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-[13px] font-medium text-muted">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@correo.com"
          className="input-editorial"
        />
      </div>
      <Button
        type="submit"
        className="w-full sm:w-auto sm:self-start sm:px-10"
        disabled={enviando}
      >
        {enviando ? "Enviando…" : "Enviarme el link"}
      </Button>
    </form>
  );
}
