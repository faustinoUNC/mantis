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

// STORY-980: tab Sistema — eventos administrativos (eventos_sistema).

export interface EventoSistema {
  id: string;
  tipo: string;
  detalle: Record<string, unknown> | null;
  creado_en: string;
  actor_nombre: string; // "Registro público" cuando no hubo sesión
  actor_rol: Rol | null;
  afectado: string; // snapshot congelado en detalle
  afectado_email: string | null;
}

export interface FiltrosSistema {
  busqueda?: string; // nombre del afectado
  actorId?: string;
  tipo?: string;
  desde?: string; // YYYY-MM-DD
  hasta?: string; // YYYY-MM-DD
  pagina?: number; // 1-based
}

export interface PaginaSistema {
  eventos: EventoSistema[];
  total: number;
}
