import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { verificarEmailTecnico } from "@/features/tecnicos/service";

// Página PÚBLICA: destino del link "Verificar mi correo" (STORY-955).
// Recién acá la solicitud le llega al staff (trigger de notificación).
export default async function VerificarEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const resultado = token ? await verificarEmailTecnico(token) : "invalido";
  const ok = resultado !== "invalido";

  return (
    <main className="fondo-tecnico flex-1 flex flex-col justify-center px-6 sm:px-[10vw] py-10">
      <div className="max-w-xl animate-aparecer">
        <Badge tono={ok ? "brand" : "error"}>
          {ok ? "Correo verificado" : "Link inválido"}
        </Badge>
        <h1
          className="mt-4 font-black uppercase tracking-tight leading-[0.95] text-4xl sm:text-5xl"
          style={{ fontStretch: "125%" }}
        >
          {ok ? (
            <>
              ¡Listo! Tu solicitud
              <br />
              está en evaluación<span className="text-brand">.</span>
            </>
          ) : (
            <>
              Este link
              <br />
              no funciona<span className="text-brand">.</span>
            </>
          )}
        </h1>
        <p className="mt-4 text-[15px] text-muted max-w-md leading-relaxed">
          {ok
            ? "Tu correo quedó confirmado y la inmobiliaria ya recibió tu solicitud para revisarla. Si te aprueban, te va a llegar un email con el link para crear tu contraseña y entrar al sistema."
            : "El link de verificación no es válido. Si todavía no verificaste tu correo, volvé a registrarte para recibir uno nuevo."}
        </p>
        <p className="mt-8 text-sm text-muted">
          {ok ? (
            <Link href="/" className="font-medium text-brand hover:text-brand-hover">
              Ir al ingreso
            </Link>
          ) : (
            <Link
              href="/registro-tecnico"
              className="font-medium text-brand hover:text-brand-hover"
            >
              Volver al registro
            </Link>
          )}
        </p>
      </div>
    </main>
  );
}
