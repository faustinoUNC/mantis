// STORY-974: tipos y constantes de la Auditoría fuera de service.ts — un
// archivo "use server" solo puede exportar funciones async (lección STORY-950).

import type { Rol } from "@/features/auth/types";

export const AUDITORIA_POR_PAGINA = 20;

export interface EventoAuditoria {
  id: string;
  tipo: string;
  de_etapa: string | null;
  a_etapa: string | null;
  detalle: Record<string, unknown> | null;
  creado_en: string;
  gestion_id: string;
  gestion_descripcion: string;
  direccion: string;
  actor_nombre: string;
  actor_rol: Rol | null;
}

export interface FiltrosAuditoria {
  busqueda?: string; // dirección o descripción de la gestión
  actorId?: string;
  tipo?: string;
  desde?: string; // YYYY-MM-DD
  hasta?: string; // YYYY-MM-DD
  pagina?: number; // 1-based
}

export interface PaginaAuditoria {
  eventos: EventoAuditoria[];
  total: number;
}

export interface ActorAuditoria {
  id: string;
  nombre: string;
  rol: Rol;
}
