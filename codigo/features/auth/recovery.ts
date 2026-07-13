import { createAdminClient } from "@/shared/lib/supabase/admin";
import { baseUrl } from "@/shared/utils/base-url";

// Link a la página propia de creación de contraseña (STORY-955): recovery
// de Supabase pero enviado por Resend — se usa el hashed_token contra
// /crear-contrasena (verifyOtp), nunca el action_link de Supabase.
// SIN "use server" a propósito: emite credenciales de acceso, jamás debe
// quedar expuesta como server action — solo la llaman otros services.
export async function linkCrearContrasena(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  const token = data?.properties?.hashed_token;
  if (error || !token) return null;
  return `${baseUrl()}/crear-contrasena?token_hash=${encodeURIComponent(token)}`;
}
