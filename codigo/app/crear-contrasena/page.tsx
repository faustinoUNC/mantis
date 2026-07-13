import { CrearContrasenaForm } from "@/components/auth/crear-contrasena.client";

// Página PÚBLICA: destino de los links de recovery enviados por Resend
// (aprobación de técnico, "olvidé mi contraseña", blanqueo del admin).
export default async function CrearContrasenaPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const { token_hash } = await searchParams;

  return (
    <main className="fondo-tecnico flex-1 flex flex-col justify-center px-6 sm:px-[12vw] py-12">
      <div className="max-w-md">
        <p className="animate-aparecer text-[13px] font-medium text-muted mb-5">
          Sistema interno · Inmobiliaria
        </p>
        <h1
          className="animate-aparecer font-black uppercase tracking-tight leading-[0.95] text-4xl sm:text-5xl"
          style={{ fontStretch: "125%", animationDelay: "60ms" }}
        >
          Creá tu
          <br />
          contraseña<span className="text-brand">.</span>
        </h1>
        <p
          className="animate-aparecer mt-4 text-[15px] text-muted max-w-xs leading-relaxed"
          style={{ animationDelay: "120ms" }}
        >
          Elegí la contraseña con la que vas a entrar al sistema.
        </p>
        <div className="animate-aparecer mt-10" style={{ animationDelay: "200ms" }}>
          <CrearContrasenaForm tokenHash={token_hash ?? null} />
        </div>
      </div>
    </main>
  );
}
