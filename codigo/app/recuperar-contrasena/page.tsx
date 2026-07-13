import Link from "next/link";
import { RecuperarContrasenaForm } from "@/components/auth/recuperar-contrasena.client";

// Página PÚBLICA: pedir el link para restablecer la contraseña (STORY-955).
export default function RecuperarContrasenaPage() {
  return (
    <main className="fondo-tecnico flex-1 flex flex-col justify-center px-6 sm:px-[12vw] py-12">
      <div className="max-w-md">
        <Link
          href="/"
          className="animate-aparecer text-sm font-medium text-muted hover:text-foreground"
        >
          ← Volver al ingreso
        </Link>
        <h1
          className="animate-aparecer mt-5 font-black uppercase tracking-tight leading-[0.95] text-4xl sm:text-5xl"
          style={{ fontStretch: "125%", animationDelay: "60ms" }}
        >
          ¿Olvidaste tu
          <br />
          contraseña<span className="text-brand">?</span>
        </h1>
        <p
          className="animate-aparecer mt-4 text-[15px] text-muted max-w-xs leading-relaxed"
          style={{ animationDelay: "120ms" }}
        >
          Escribí tu correo y te mandamos un link para crear una nueva.
        </p>
        <div className="animate-aparecer mt-10" style={{ animationDelay: "200ms" }}>
          <RecuperarContrasenaForm />
        </div>
      </div>
    </main>
  );
}
