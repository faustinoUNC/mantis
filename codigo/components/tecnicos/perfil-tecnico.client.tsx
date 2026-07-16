"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputPassword } from "@/components/ui/input-password.client";
import { actualizarMiContacto } from "@/features/tecnicos/service";
import { createClient } from "@/shared/lib/supabase/client";
import { errorTelefono } from "@/shared/utils/telefono";

// El contacto es del técnico (STORY-959): email y teléfono se editan acá,
// no desde la inmobiliaria. Mobile-first: targets ≥44px, edición inline.
export function ContactoPerfil({
  email,
  telefono,
}: {
  email: string;
  telefono: string | null;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valores, setValores] = useState({ email, telefono: telefono ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!valores.email.trim() || !valores.telefono.trim()) {
      return setError("Completá email y teléfono.");
    }
    const errTelefono = errorTelefono(valores.telefono);
    if (errTelefono) return setError(errTelefono);
    setGuardando(true);
    const r = await actualizarMiContacto(valores);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    setEditando(false);
    router.refresh();
  }

  if (!editando) {
    return (
      <>
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted">Correo</p>
            <p className="mt-0.5 truncate">{email}</p>
          </div>
          <Button
            variante="fantasma"
            className="min-h-tap px-3 text-sm shrink-0"
            onClick={() => {
              setValores({ email, telefono: telefono ?? "" });
              setError(null);
              setEditando(true);
            }}
          >
            Editar
          </Button>
        </div>
        <div className="px-4 py-3">
          <p className="text-[13px] font-medium text-muted">Teléfono</p>
          <p className="mt-0.5">{telefono ?? "—"}</p>
        </div>
      </>
    );
  }

  return (
    <div className="px-4 py-4">
      <p className="text-[13px] font-medium text-muted mb-3">Editar contacto</p>
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <Input
          label="Correo electrónico"
          type="email"
          required
          value={valores.email}
          onChange={(e) => setValores({ ...valores, email: e.target.value })}
        />
        <Input
          label="Teléfono"
          required
          inputMode="numeric"
          value={valores.telefono}
          onChange={(e) =>
            setValores({ ...valores, telefono: e.target.value.replace(/\D/g, "") })
          }
          placeholder="Solo números"
        />
        {error && (
          <p role="alert" className="text-sm font-medium text-error">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={guardando} className="flex-1">
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
          <Button
            type="button"
            variante="fantasma"
            className="flex-1"
            onClick={() => setEditando(false)}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}

// Cambio de contraseña estando logueado (STORY-959): contraseña actual +
// nueva, todo en el browser (auth.* permitido por ARQUITECTURA). La actual
// se verifica re-autenticando — sin emails de por medio (para eso está
// "¿Olvidaste tu contraseña?" en el login).
export function CambiarContrasena() {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const actual = String(form.get("actual"));
    const nueva = String(form.get("nueva"));
    if (nueva.length < 8) {
      return setError("La contraseña nueva debe tener al menos 8 caracteres.");
    }
    if (nueva === actual) {
      return setError("La contraseña nueva no puede ser igual a la actual.");
    }
    setGuardando(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      setGuardando(false);
      return setError("No se pudo verificar tu sesión. Volvé a entrar.");
    }
    const { error: errorActual } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: actual,
    });
    if (errorActual) {
      setGuardando(false);
      return setError("La contraseña actual no es correcta.");
    }
    const { error: errorNueva } = await supabase.auth.updateUser({
      password: nueva,
    });
    setGuardando(false);
    if (errorNueva) {
      // Refuerzo del chequeo previo (GoTrue también lo valida server-side).
      return setError(
        errorNueva.code === "same_password"
          ? "La contraseña nueva no puede ser igual a la actual."
          : "No se pudo guardar la contraseña. Probá de nuevo."
      );
    }
    setExito(true);
    setAbierto(false);
  }

  return (
    <div className="px-4 py-3">
      {abierto ? (
        <>
          <p className="text-[13px] font-medium text-muted mb-3">
            Cambiar contraseña
          </p>
          <form onSubmit={guardar} className="flex flex-col gap-4">
            <InputPassword
              label="Contraseña actual"
              name="actual"
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
            <InputPassword
              label="Contraseña nueva"
              name="nueva"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
            />
            {error && (
              <p role="alert" className="text-sm font-medium text-error">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={guardando} className="flex-1">
                {guardando ? "Guardando…" : "Guardar"}
              </Button>
              <Button
                type="button"
                variante="fantasma"
                className="flex-1"
                onClick={() => setAbierto(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-muted">Contraseña</p>
            <p className="mt-0.5">
              {exito ? "Actualizada ✓" : "••••••••"}
            </p>
          </div>
          <Button
            variante="fantasma"
            className="min-h-tap px-3 text-sm shrink-0"
            onClick={() => {
              setError(null);
              setAbierto(true);
            }}
          >
            Cambiar
          </Button>
        </div>
      )}
    </div>
  );
}
