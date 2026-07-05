import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form.client";
import { obtenerUsuarioActual } from "@/features/auth/service";

// Login editorial: tipografía como protagonista, asimétrico, con pulso.
// Concepto en DESIGN.md — nada de card centrada ni banner lateral.
export default async function LoginPage() {
  const usuario = await obtenerUsuarioActual();
  if (usuario) redirect("/panel");

  return (
    <main className="fondo-tecnico flex-1 flex flex-col justify-center px-6 sm:px-[12vw] py-12 overflow-hidden">
      <div className="max-w-md">
        <p className="animate-aparecer text-[13px] font-medium text-muted mb-5">
          Sistema interno · Inmobiliaria
        </p>

        <h1
          className="animate-aparecer font-black uppercase leading-[0.92] tracking-tight text-[clamp(3.5rem,9vw,6.5rem)] select-none"
          style={{ fontStretch: "125%", animationDelay: "60ms" }}
        >
          <span className="whitespace-nowrap">
            Man
            <span
              className="inline-block align-baseline bg-brand animate-latido origin-left"
              style={{
                width: "0.5em",
                height: "0.09em",
                marginLeft: "0.06em",
                marginBottom: "0.07em",
              }}
              aria-hidden
            />
          </span>
          <br />
          tis
        </h1>

        <p
          className="animate-aparecer mt-4 text-[15px] text-muted max-w-xs leading-relaxed"
          style={{ animationDelay: "140ms" }}
        >
          Gestión de mantenimiento inmobiliario: del reporte a la liquidación.
        </p>

        <div
          className="animate-aparecer mt-10"
          style={{ animationDelay: "220ms" }}
        >
          <LoginForm />
        </div>

        <p
          className="animate-aparecer mt-10 text-sm text-muted"
          style={{ animationDelay: "300ms" }}
        >
          ¿Sos técnico y todavía no tenés cuenta?{" "}
          <span className="font-medium text-brand">Enrolate acá</span>
        </p>
      </div>
    </main>
  );
}
