import { obtenerUsuarioActual } from "@/features/auth/service";
import { createAdminClient } from "@/shared/lib/supabase/admin";

// STORY-980: log de acciones administrativas (eventos_sistema). Módulo SIN
// "use server" a propósito: escribe con admin client y no debe existir como
// endpoint invocable desde el cliente — solo lo importan otros services.
// El actor sale de la sesión; sin sesión (postulación pública) queda NULL.
// `detalle` lleva los hechos congelados del afectado (nombre/email/rol…):
// la evidencia no cambia si después renombran o borran al usuario.
export async function registrarEventoSistema(
  tipo: string,
  detalle: Record<string, unknown>
): Promise<void> {
  const actual = await obtenerUsuarioActual();
  const admin = createAdminClient();
  // Si el insert falla no voltea la acción (mismo criterio que los inserts
  // de eventos_gestion en los services).
  await admin
    .from("eventos_sistema")
    .insert({ tipo, actor_id: actual?.id ?? null, detalle });
}
