import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form.client";
import { obtenerUsuarioActual } from "@/features/auth/service";

export default async function LoginPage() {
  // Con sesión activa, directo al panel del rol.
  const usuario = await obtenerUsuarioActual();
  if (usuario) redirect("/panel");
  return (
    <main className="flex-1 grid lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de marca */}
      <section className="relative bg-tinta text-papel px-8 py-10 lg:px-16 lg:py-14 flex flex-col justify-between overflow-hidden">
        <div className="franja-obra absolute top-0 left-0 right-0 h-1.5" />

        <header className="animate-aparecer">
          <span className="etiqueta text-mantis-300">
            Sistema interno · Inmobiliaria
          </span>
        </header>

        <div className="py-14 lg:py-0">
          <h1
            className="animate-aparecer font-black uppercase leading-[0.9] tracking-tight text-[clamp(3.5rem,10vw,7.5rem)]"
            style={{ fontStretch: "125%", animationDelay: "80ms" }}
          >
            Man
            <span className="text-senal-400">—</span>
            <br />
            tis
          </h1>
          <p
            className="animate-aparecer mt-6 max-w-sm text-papel/70 text-[0.9375rem] leading-relaxed"
            style={{ animationDelay: "160ms" }}
          >
            Gestión de mantenimiento de propiedades: del reporte a la
            liquidación, todo en un solo tablero.
          </p>
        </div>

        <footer
          className="animate-aparecer hidden lg:flex items-center gap-3"
          style={{ animationDelay: "240ms" }}
        >
          <Badge tono="senal">v2</Badge>
          <span className="etiqueta text-papel/50">
            reporte → obra → cobro
          </span>
        </footer>
      </section>

      {/* Formulario */}
      <section className="flex items-center justify-center px-5 py-10 lg:px-12">
        <Card
          className="animate-aparecer w-full max-w-sm p-7 sm:p-9"
          style={{ animationDelay: "200ms" }}
        >
          <div className="flex flex-col gap-1 mb-7">
            <h2 className="text-xl font-bold">Ingresar</h2>
            <p className="text-sm text-neutral-600">
              Accedé con tu cuenta de empleado o técnico.
            </p>
          </div>

          <LoginForm />

          <div className="regla-plano my-7" />

          <p className="text-sm text-neutral-600 text-center">
            ¿Sos técnico y todavía no tenés cuenta?{" "}
            <span className="font-semibold text-mantis-600">
              Enrolate acá
            </span>
          </p>
        </Card>
      </section>
    </main>
  );
}
