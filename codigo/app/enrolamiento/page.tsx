import Link from "next/link";
import { EnrolamientoForm } from "@/components/tecnicos/enrolamiento.client";
import { listarEspecialidadesActivas } from "@/features/especialidades/service";

// Página PÚBLICA de enrolamiento de técnicos — mobile-first, estilo editorial.
export default async function EnrolamientoPage() {
  const especialidades = await listarEspecialidadesActivas();

  return (
    <main className="fondo-tecnico flex-1 px-6 sm:px-[10vw] py-10">
      <div className="max-w-xl">
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
          Sumate como
          <br />
          técnico<span className="text-brand">.</span>
        </h1>
        <p
          className="animate-aparecer mt-4 text-[15px] text-muted max-w-md leading-relaxed"
          style={{ animationDelay: "120ms" }}
        >
          Completá tus datos y subí tu documentación. El equipo la revisa y te
          habilita el acceso.
        </p>

        <div className="animate-aparecer mt-8" style={{ animationDelay: "200ms" }}>
          <EnrolamientoForm especialidades={especialidades} />
        </div>
      </div>
    </main>
  );
}
