import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Cliente ADMIN (service role, bypasea RLS).
// SOLO para operaciones administrativas puntuales: crear usuarios, revocar sesiones.
// Nunca importar desde código de cliente.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
