// STORY-1007 — Walter: catálogo de tools por rol. Módulo SERVER-ONLY (lo
// importa solo el route handler del asistente — nunca un client component).
//
// Seguridad (3 capas, ninguna sola alcanza):
//   1. Este catálogo se construye con el rol de la SESIÓN (obtenerUsuarioActual
//      en el route handler) — el rol jamás viaja desde el cliente.
//   2. Cada tool reusa los services de features/* con sus propias validaciones.
//   3. Los services usan el cliente Supabase de sesión → RLS scopea (ownership
//      del gestor, técnico solo lo suyo). PROHIBIDO el admin client acá.
import { tool } from "ai";
import { z } from "zod";
import type { Rol, UsuarioActual } from "@/features/auth/types";
import { historialGlobal, historialSistema } from "@/features/auditoria/service";
import {
  historialPropiedad,
  listarPersonas,
  listarPropiedades,
} from "@/features/cartera/service";
import { listarEmpleados } from "@/features/empleados/service";
import { listarEspecialidades } from "@/features/especialidades/service";
import { listarInbox } from "@/features/inbox/service";
import {
  estadisticasTecnicos,
  gestionesArchivadas,
  obtenerGestion,
  tableroGestiones,
} from "@/features/gestiones/service";
import { ETAPAS, ETAPAS_TERMINALES, type GestionResumen, type StatsTecnico } from "@/features/gestiones/types";
import { obtenerMetricas } from "@/features/metricas/service";
import { misNotificaciones } from "@/features/notificaciones/service";
import { NOMBRE_ROL } from "@/features/auth/types";
import { listarTecnicos, misFranjas } from "@/features/tecnicos/service";
import { DIAS } from "@/features/tecnicos/types";
import { rutaPermitida } from "./config";

const ETIQUETA_ETAPA: Record<string, string> = {
  ...Object.fromEntries(ETAPAS.map((e) => [e.id, e.label])),
  cancelada: "Cancelada",
};

const ETAPA_IDS = [...ETAPAS.map((e) => e.id), "cancelada"] as unknown as [string, ...string[]];

const fecha = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : null;

const plata = (n: number | null | undefined) =>
  n == null ? null : `$${Math.round(Number(n)).toLocaleString("es-AR")}`;

const trunc = (s: string | null | undefined, n: number) =>
  !s ? null : s.length > n ? `${s.slice(0, n)}…` : s;

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Resumen compacto de una gestión PARA EL MODELO (nombres legibles, sin UUIDs
// sueltos — el id va aparte para detalle_gestion / deep links).
function compactar(g: GestionResumen) {
  return {
    id: g.id,
    descripcion: trunc(g.descripcion, 90),
    etapa: ETIQUETA_ETAPA[g.etapa] ?? g.etapa,
    urgente: g.urgencia === "urgente" || undefined,
    especialidad: g.especialidad,
    direccion: g.direccion,
    tecnico: g.tecnico_nombre,
    gestor: g.gestor_nombre,
    creada: fecha(g.creado_en),
    presupuesto_esperando_decision: g.presupuesto_pendiente || undefined,
    conformidad_rechazada: g.conformidad_rechazada || undefined,
    tecnico_aviso_no_puede_continuar: g.aviso_no_continua_en ? true : undefined,
    surgio_de_otra_gestion: g.gestion_origen_id ? true : undefined,
  };
}

function compactarStats(s: StatsTecnico | null | undefined) {
  if (!s) return null;
  return {
    estrellas: s.estrellas != null ? Math.round(s.estrellas * 10) / 10 : null,
    calificaciones: s.nCalif,
    desvio_presupuesto_pct: s.desvioPct,
    desvio_plazo_pct: s.desvioPlazoPct,
    obras_activas: s.obrasActivas,
    obras_realizadas: s.obrasRealizadas,
    rechazo_asignaciones_pct: s.pctRechazoAsig,
    abandonos: s.abandonos,
  };
}

// Errores SIEMPRE escritos para el modelo (jamás stack traces): el modelo los
// convierte en una disculpa amable y sigue.
function seguro<A, R>(fn: (args: A) => Promise<R>) {
  return async (args: A): Promise<R | { error: string }> => {
    try {
      return await fn(args);
    } catch {
      return { error: "No pude consultar esos datos ahora. Probá de nuevo en un momento." };
    }
  };
}

export function crearTools(usuario: UsuarioActual) {
  const rol = usuario.rol;
  const esStaff = rol !== "tecnico";
  const veTecnicos = rol === "administrador" || rol === "gestor_mantenimiento";
  const veCartera = esStaff;
  const esAdmin = rol === "administrador";

  // ── Compartidas (todos los roles) ──

  const buscar_gestiones = tool({
    description:
      "Buscá gestiones activas (las del alcance del usuario) filtrando por etapa, urgencia, texto libre (dirección, descripción, propietario, inquilino) o técnico. Usala cuando pregunten qué gestiones hay en tal etapa, de tal dirección o de tal técnico. Devuelve una lista compacta con id para detalle_gestion o para el deep link /gestiones/<id>.",
    inputSchema: z.object({
      etapa: z.enum(ETAPA_IDS).optional().describe("Etapa exacta del funnel"),
      urgencia: z.enum(["urgente", "normal"]).optional(),
      texto: z.string().optional().describe("Búsqueda libre: dirección, descripción, propietario o inquilino"),
      tecnico: z.string().optional().describe("Nombre (o parte) del técnico asignado"),
    }),
    execute: seguro(async ({ etapa, urgencia, texto, tecnico }) => {
      const todas = await tableroGestiones();
      let lista = todas;
      if (etapa) lista = lista.filter((g) => g.etapa === etapa);
      if (urgencia) lista = lista.filter((g) => g.urgencia === urgencia);
      if (tecnico) {
        const t = norm(tecnico);
        lista = lista.filter((g) => g.tecnico_nombre && norm(g.tecnico_nombre).includes(t));
      }
      if (texto) {
        const t = norm(texto);
        lista = lista.filter((g) =>
          [g.direccion, g.descripcion, g.propietario_nombre, g.inquilino_nombre]
            .filter(Boolean)
            .some((c) => norm(c as string).includes(t))
        );
      }
      return {
        total: lista.length,
        mostrando: Math.min(lista.length, 15),
        gestiones: lista.slice(0, 15).map(compactar),
      };
    }),
  });

  const detalle_gestion = tool({
    description:
      "El detalle completo de UNA gestión por su id (conseguilo antes con buscar_gestiones o mis_pendientes): etapa, presupuestos, avances, conformidad, montos, contacto para coordinar la visita, calificación y últimos movimientos. Usala para 'contame de la gestión X' o '¿en qué está lo de tal dirección?'.",
    inputSchema: z.object({
      id: z.string().uuid().describe("El id de la gestión"),
    }),
    execute: seguro(async ({ id }) => {
      const g = await obtenerGestion(id);
      if (!g) return { error: "No encontré esa gestión (o no está en tu alcance)." };
      const aprobado = g.presupuestos.find((p) => p.estado === "aprobado");
      return {
        ...compactar(g),
        direccion_completa: g.propiedad_unidad ? `${g.direccion} — ${g.propiedad_unidad}` : g.direccion,
        propietario: g.propietario_nombre,
        inquilino: g.inquilino_nombre,
        contacto_para_visita: g.contacto_cliente
          ? { tipo: g.contacto_cliente.tipo, nombre: g.contacto_cliente.nombre, telefono: g.contacto_cliente.telefono }
          : null,
        pagador: g.pagador,
        presupuestos: g.presupuestos.map((p) => ({
          estado: p.estado,
          materiales: plata(p.monto_materiales),
          mano_obra: plata(p.monto_mano_obra),
          plazo_dias: p.plazo_dias,
          trabajo: trunc(p.descripcion_trabajo, 120),
          motivo_rechazo: p.motivo_rechazo,
        })),
        plazo_comprometido_dias: aprobado?.plazo_dias ?? null,
        avances: g.avances.length,
        ultimo_avance: g.avances.at(-1)
          ? { tipo: g.avances.at(-1)!.tipo, nota: trunc(g.avances.at(-1)!.nota, 120), fecha: fecha(g.avances.at(-1)!.creado_en) }
          : null,
        conformidad: g.conformidades.at(-1)?.estado ?? null,
        costo_final: plata(g.costo_final),
        cargo_admin: plata(g.cargo_admin),
        adelanto_materiales: plata(g.adelanto_materiales),
        rendicion_materiales: plata(g.materiales_total),
        calificacion_estrellas: g.calificacion?.estrellas ?? null,
        motivo_aviso_tecnico: trunc(g.aviso_no_continua_motivo, 120),
        vinculadas: g.vinculadas.map((v) => ({
          id: v.id,
          descripcion: trunc(v.descripcion, 60),
          etapa: ETIQUETA_ETAPA[v.etapa] ?? v.etapa,
        })),
        ultimos_movimientos: g.eventos.slice(-5).map((e) => ({
          tipo: e.tipo,
          a_etapa: e.a_etapa ? ETIQUETA_ETAPA[e.a_etapa] : null,
          actor: e.actor?.nombre ?? null,
          fecha: fecha(e.creado_en),
        })),
      };
    }),
  });

  const gestiones_archivadas = tool({
    description:
      "Las gestiones finalizadas que se archivaron (salieron del tablero). Usala si preguntan por el archivo o por un trabajo viejo que no aparece en el tablero.",
    inputSchema: z.object({
      texto: z.string().optional().describe("Filtro libre por dirección o descripción"),
    }),
    execute: seguro(async ({ texto }) => {
      let lista = await gestionesArchivadas();
      if (texto) {
        const t = norm(texto);
        lista = lista.filter((g) =>
          [g.direccion, g.descripcion].some((c) => norm(c).includes(t))
        );
      }
      return {
        total: lista.length,
        gestiones: lista.slice(0, 15).map((g) => ({
          ...compactar(g),
          archivada: fecha(g.archivada_en),
        })),
      };
    }),
  });

  const mis_pendientes = tool({
    description:
      "Lo accionable AHORA para el usuario según su rol: qué necesita su decisión o su próximo paso. Usala para '¿qué tengo pendiente?', '¿qué me toca hoy?', '¿qué necesita atención?'.",
    inputSchema: z.object({}),
    execute: seguro(async () => {
      const todas = await tableroGestiones();
      if (rol === "tecnico") {
        return {
          asignaciones_por_responder: todas
            .filter((g) => g.etapa === "asignacion" && g.asignacion_aceptada == null && g.tecnico_nombre)
            .map(compactar),
          presupuestos_por_enviar: todas
            .filter((g) => g.etapa === "presupuesto" && !g.presupuesto_pendiente)
            .map(compactar),
          obras_en_ejecucion: todas.filter((g) => g.etapa === "en_ejecucion").map(compactar),
          conformidades_rechazadas_a_resubir: todas
            .filter((g) => g.conformidad_rechazada)
            .map(compactar),
        };
      }
      const base = {
        ingresadas_sin_arrancar: todas.filter((g) => g.etapa === "ingresado").map(compactar),
        urgentes_sin_tecnico: todas
          .filter((g) => g.urgencia === "urgente" && ["ingresado", "asignacion"].includes(g.etapa))
          .map(compactar),
        presupuestos_esperando_decision: todas
          .filter((g) => g.presupuesto_pendiente)
          .map(compactar),
        avisos_de_tecnicos_sin_resolver: todas
          .filter((g) => g.aviso_no_continua_en)
          .map(compactar),
      };
      if (rol === "gestor_administrativo" || rol === "administrador") {
        const m = await obtenerMetricas();
        return {
          ...base,
          por_cobrar: {
            gestiones: todas.filter((g) => g.etapa === "facturacion_cobro").map(compactar),
            monto_total: plata(m?.montoPorCobrar),
          },
          por_liquidar_a_tecnicos: {
            gestiones: todas.filter((g) => g.etapa === "liquidacion_tecnico").map(compactar),
            monto_total: plata(m?.montoPorLiquidar),
          },
        };
      }
      return base;
    }),
  });

  const mis_notificaciones = tool({
    description:
      "Las últimas notificaciones del usuario (las no leídas primero). Usala si pregunta qué se perdió o qué pasó mientras no estaba.",
    inputSchema: z.object({}),
    execute: seguro(async () => {
      const todas = await misNotificaciones();
      const orden = [...todas].sort((a, b) => Number(!!a.leida_en) - Number(!!b.leida_en));
      return {
        sin_leer: todas.filter((n) => !n.leida_en).length,
        notificaciones: orden.slice(0, 10).map((n) => ({
          titulo: n.titulo,
          detalle: trunc(n.cuerpo, 100),
          fecha: fecha(n.creado_en),
          leida: !!n.leida_en,
          ruta: n.ruta,
        })),
      };
    }),
  });

  const sugerir_navegacion = tool({
    description:
      "Ofrecé botones para ir a pantallas del sistema. Usala SIEMPRE que la respuesta invite a ver o hacer algo en una pantalla (un detalle, el tablero, informes, cómo hacer X). Máximo 3 sugerencias, rutas SOLO de la lista permitida del rol (o /gestiones/<id> con un id real que hayas obtenido de otra tool).",
    inputSchema: z.object({
      sugerencias: z
        .array(
          z.object({
            label: z.string().max(40).describe("Texto del botón, corto y accionable"),
            ruta: z.string().describe("Ruta interna permitida para el rol"),
          })
        )
        .min(1)
        .max(3),
    }),
    execute: async ({ sugerencias }) => {
      // La whitelist es la garantía: lo que no valida, no se renderiza.
      const validas = sugerencias.filter((s) => rutaPermitida(rol, s.ruta));
      if (validas.length === 0) {
        return { error: "Ninguna ruta era válida para este rol. No ofrezcas esos links." };
      }
      return { botones: validas };
    },
  });

  // ── Staff (todos menos técnico) ──

  const resumen_tablero = tool({
    description:
      "Foto actual del tablero del usuario: cuántas gestiones hay por etapa, cuántas urgentes y señales de atención. Usala para '¿cómo está el tablero?', '¿cuántas gestiones tengo?'.",
    inputSchema: z.object({}),
    execute: seguro(async () => {
      const todas = await tableroGestiones();
      const porEtapa = ETAPAS.map((e) => ({
        etapa: e.label,
        gestiones: todas.filter((g) => g.etapa === e.id).length,
      })).filter((e) => e.gestiones > 0);
      return {
        // Misma definición que Informes: activa = etapa no terminal.
        activas: todas.filter((g) => !ETAPAS_TERMINALES.has(g.etapa)).length,
        finalizadas_sin_archivar: todas.filter((g) => g.etapa === "finalizado").length,
        por_etapa: porEtapa,
        urgentes: todas.filter((g) => g.urgencia === "urgente").length,
        con_presupuesto_esperando_decision: todas.filter((g) => g.presupuesto_pendiente).length,
        con_aviso_de_tecnico: todas.filter((g) => g.aviso_no_continua_en).length,
      };
    }),
  });

  const metricas_negocio = tool({
    description:
      "Los números del negocio (mismos datos que la pantalla Informes): plata por cobrar y por liquidar, ingresos cobrados por mes, tiempo de ciclo, cuellos de botella por etapa, capacidad de técnicos por especialidad. Usala para '¿cómo viene el negocio?', '¿cuánto facturamos?', '¿dónde se traba el funnel?'.",
    inputSchema: z.object({}),
    execute: seguro(async () => {
      const m = await obtenerMetricas();
      if (!m) return { error: "No hay métricas disponibles para este rol." };

      // Ingresos cobrados por mes (hechos congelados: cobrado_monto/fee).
      const porMes = new Map<string, { cobrado: number; fee: number; n: number }>();
      for (const f of m.filas) {
        if (!f.cobradoEn || f.cobradoMonto == null) continue;
        const mes = f.cobradoEn.slice(0, 7);
        const acc = porMes.get(mes) ?? { cobrado: 0, fee: 0, n: 0 };
        acc.cobrado += Number(f.cobradoMonto);
        acc.fee += Number(f.cobradoFee ?? 0);
        acc.n += 1;
        porMes.set(mes, acc);
      }
      const ingresos = [...porMes.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 3)
        .map(([mes, v]) => ({ mes, cobrado: plata(v.cobrado), fee_inmobiliaria: plata(v.fee), gestiones: v.n }));

      // Tiempo de ciclo (creación → cobro) de las cobradas, en días.
      const ciclos = m.filas
        .filter((f) => f.cobradoEn)
        .map((f) => (new Date(f.cobradoEn!).getTime() - new Date(f.creadoEn).getTime()) / 86400000)
        .filter((d) => d >= 0);
      const cicloPromedio = ciclos.length
        ? Math.round((ciclos.reduce((s, d) => s + d, 0) / ciclos.length) * 10) / 10
        : null;

      // Cuellos de botella: días promedio de permanencia por etapa (event log).
      const porGestion = new Map<string, { aEtapa: string | null; t: number }[]>();
      for (const e of m.eventos) {
        const lista = porGestion.get(e.gestionId) ?? [];
        lista.push({ aEtapa: e.aEtapa, t: new Date(e.creadoEn).getTime() });
        porGestion.set(e.gestionId, lista);
      }
      const permanencia = new Map<string, { total: number; n: number }>();
      for (const evs of porGestion.values()) {
        const orden = [...evs].sort((a, b) => a.t - b.t);
        for (let i = 0; i < orden.length - 1; i++) {
          const etapa = orden[i].aEtapa;
          if (!etapa) continue;
          const dias = (orden[i + 1].t - orden[i].t) / 86400000;
          const acc = permanencia.get(etapa) ?? { total: 0, n: 0 };
          acc.total += dias;
          acc.n += 1;
          permanencia.set(etapa, acc);
        }
      }
      const cuellos = [...permanencia.entries()]
        .map(([etapa, v]) => ({
          etapa: ETIQUETA_ETAPA[etapa] ?? etapa,
          dias_promedio: Math.round((v.total / v.n) * 10) / 10,
        }))
        .sort((a, b) => b.dias_promedio - a.dias_promedio)
        .slice(0, 4);

      return {
        alcance: rol === "gestor_mantenimiento" ? "solo tus gestiones" : "todo el sistema",
        activas: m.activas,
        urgentes_sin_asignar: m.urgentesSinAsignar,
        por_cobrar: { gestiones: m.pendientesCobro, monto: plata(m.montoPorCobrar) },
        por_liquidar: { gestiones: m.pendientesLiquidacion, monto: plata(m.montoPorLiquidar) },
        ingresos_por_mes: ingresos,
        tiempo_ciclo_promedio_dias: cicloPromedio,
        cuellos_de_botella: cuellos,
        capacidad_tecnicos: m.capacidad,
        abandonos_por_tecnico: m.abandonos,
      };
    }),
  });

  const consultar_cartera = tool({
    description:
      "La cartera de la inmobiliaria: propiedades administradas (con propietario e inquilino actual), o el listado de propietarios o inquilinos con su contacto. Usala para '¿qué propiedades administramos?', 'el teléfono de tal propietario', '¿está ocupada tal dirección?'.",
    inputSchema: z.object({
      tipo: z.enum(["propiedades", "propietarios", "inquilinos"]),
      texto: z.string().optional().describe("Filtro libre por nombre o dirección"),
    }),
    execute: seguro(async ({ tipo, texto }) => {
      const t = texto ? norm(texto) : null;
      if (tipo === "propiedades") {
        let lista = await listarPropiedades();
        if (t)
          lista = lista.filter((p) =>
            [p.direccion, p.propietario_nombre, p.inquilino_nombre]
              .filter(Boolean)
              .some((c) => norm(c as string).includes(t))
          );
        return {
          total: lista.length,
          propiedades: lista.slice(0, 15).map((p) => ({
            id: p.id,
            direccion: p.unidad ? `${p.direccion} — ${p.unidad}` : p.direccion,
            tipo: p.tipo,
            propietario: p.propietario_nombre,
            inquilino: p.inquilino_nombre ?? (p.ocupada ? "ocupada" : "sin ocupar"),
            activa: p.activa,
          })),
        };
      }
      let personas = await listarPersonas(tipo);
      if (t) personas = personas.filter((p) => norm(p.nombre).includes(t));
      return {
        total: personas.length,
        [tipo]: personas.slice(0, 15).map((p) => ({
          nombre: p.nombre,
          telefono: p.telefono,
          email: p.email,
          activo: p.activo,
        })),
      };
    }),
  });

  const historial_propiedad = tool({
    description:
      "La historia completa de una propiedad: sus períodos de ocupación (legajos) y todas las obras de cada período, con estado, costo y reincidencias. Usala para '¿qué se hizo en tal dirección?', '¿cuánto se invirtió en tal propiedad?'. Pasale el id (conseguilo con consultar_cartera).",
    inputSchema: z.object({
      id: z.string().uuid().describe("El id de la propiedad"),
    }),
    execute: seguro(async ({ id }) => {
      const capitulos = await historialPropiedad(id);
      if (!capitulos) return { error: "No encontré esa propiedad (o no está en tu alcance)." };
      const obras = capitulos.flatMap((c) => c.obras);
      const porEspecialidad = new Map<string, number>();
      for (const o of obras) {
        porEspecialidad.set(o.especialidad, (porEspecialidad.get(o.especialidad) ?? 0) + 1);
      }
      return {
        total_obras: obras.length,
        terminadas: obras.filter((o) => o.estado === "terminada").length,
        total_invertido: plata(
          obras.reduce((s, o) => s + (o.costo ?? 0), 0)
        ),
        reincidencias: [...porEspecialidad.entries()]
          .filter(([, n]) => n >= 3)
          .map(([especialidad, n]) => ({ especialidad, obras: n })),
        periodos: capitulos.map((c) => ({
          ocupante: c.titulo,
          desde: c.desde,
          hasta: c.hasta ?? (c.vigente ? "vigente" : null),
          obras: c.obras.slice(0, 10).map((o) => ({
            que_se_hizo: trunc(o.trabajo ?? o.problema, 80),
            especialidad: o.especialidad,
            tecnico: o.tecnico,
            estado: o.estado,
            costo: plata(o.costo),
            terminada: fecha(o.terminada_en),
          })),
        })),
      };
    }),
  });

  // ── Solo administrador + gestor comercial ──

  const ranking_tecnicos = tool({
    description:
      "El ranking de desempeño de los técnicos aprobados: calificación promedio (estrellas), desvío de presupuesto y de plazo, obras activas y realizadas, rechazos de asignación y abandonos. Usala para '¿cuál es el mejor técnico?', '¿a quién conviene asignar?', '¿quién abandona trabajos?'.",
    inputSchema: z.object({}),
    execute: seguro(async () => {
      const tecnicos = (await listarTecnicos()).filter(
        (t) => t.estado === "aprobado" && t.esta_activo !== false
      );
      const stats = await estadisticasTecnicos(tecnicos.map((t) => t.id));
      const lista = tecnicos
        .map((t) => ({
          id: t.id,
          nombre: t.nombre,
          especialidades: t.especialidades,
          ...compactarStats(stats.get(t.id)),
        }))
        .sort((a, b) => (b.estrellas ?? -1) - (a.estrellas ?? -1));
      return { tecnicos: lista };
    }),
  });

  const detalle_tecnico = tool({
    description:
      "El perfil completo de UN técnico por nombre: contacto, especialidades, estado y su desempeño (estrellas, desvíos, obras, abandonos). Usala cuando pregunten por un técnico puntual.",
    inputSchema: z.object({
      nombre: z.string().describe("Nombre (o parte) del técnico"),
    }),
    execute: seguro(async ({ nombre }) => {
      const t = norm(nombre);
      const candidatos = (await listarTecnicos()).filter((x) => norm(x.nombre).includes(t));
      if (candidatos.length === 0) return { error: "No encontré un técnico con ese nombre." };
      if (candidatos.length > 3) {
        return {
          error: "Hay varios técnicos que matchean — pedí más precisión.",
          coincidencias: candidatos.slice(0, 10).map((c) => c.nombre),
        };
      }
      const stats = await estadisticasTecnicos(candidatos.map((c) => c.id));
      return {
        tecnicos: candidatos.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          email: c.email,
          telefono: c.telefono,
          estado: c.estado,
          activo: c.esta_activo,
          especialidades: c.especialidades,
          desempeno: compactarStats(stats.get(c.id)),
        })),
      };
    }),
  });

  const inbox_reportes = tool({
    description:
      "Los reportes del inbox (mails de propietarios/inquilinos) pendientes de convertir en gestión o descartar. Usala para '¿hay reportes nuevos?', '¿qué entró al inbox?'.",
    inputSchema: z.object({}),
    execute: seguro(async () => {
      const reportes = await listarInbox();
      return {
        pendientes: reportes.length,
        reportes: reportes.slice(0, 10).map((r) => ({
          remitente: r.remitente,
          asunto: r.asunto,
          resumen: trunc(r.cuerpo, 150),
          recibido: fecha(r.recibido_en),
        })),
      };
    }),
  });

  // ── Solo administrador ──

  const auditoria_reciente = tool({
    description:
      "Quién hizo qué: los últimos eventos de auditoría, de las gestiones (transiciones, presupuestos) o del sistema (altas/bajas de empleados y técnicos, cambios de rol). Usala para '¿qué pasó hoy?', '¿quién movió tal gestión?', '¿quién aprobó a tal técnico?'.",
    inputSchema: z.object({
      ambito: z.enum(["gestiones", "sistema"]).describe("gestiones = el funnel; sistema = identidad y accesos"),
      busqueda: z.string().optional().describe("Filtro: dirección/descripción (gestiones) o nombre del afectado (sistema)"),
    }),
    execute: seguro(async ({ ambito, busqueda }) => {
      if (ambito === "sistema") {
        const p = await historialSistema({ busqueda, pagina: 1 });
        return {
          total: p.total,
          eventos: p.eventos.slice(0, 10).map((e) => ({
            tipo: e.tipo,
            afectado: e.afectado,
            actor: e.actor_nombre,
            fecha: fecha(e.creado_en),
          })),
        };
      }
      const p = await historialGlobal({ busqueda, pagina: 1 });
      return {
        total: p.total,
        eventos: p.eventos.slice(0, 10).map((e) => ({
          tipo: e.tipo,
          gestion: trunc(e.gestion_descripcion, 60),
          direccion: e.direccion,
          a_etapa: e.a_etapa ? ETIQUETA_ETAPA[e.a_etapa] ?? e.a_etapa : null,
          actor: e.actor_nombre,
          fecha: fecha(e.creado_en),
        })),
      };
    }),
  });

  const equipo_interno = tool({
    description:
      "El equipo interno del sistema: empleados (con rol y estado) y especialidades configuradas. Usala para '¿qué empleados hay?', '¿qué especialidades manejamos?'.",
    inputSchema: z.object({}),
    execute: seguro(async () => {
      const [empleados, especialidades] = await Promise.all([
        listarEmpleados(),
        listarEspecialidades(),
      ]);
      return {
        empleados: empleados.map((e) => ({
          nombre: e.nombre,
          rol: NOMBRE_ROL[e.rol],
          activo: e.esta_activo,
        })),
        especialidades: especialidades.map((e) => e.nombre),
      };
    }),
  });

  // ── Solo técnico ──

  const mi_agenda = tool({
    description:
      "Las franjas de disponibilidad horaria del técnico (su agenda semanal). Usala para '¿qué horarios tengo cargados?'.",
    inputSchema: z.object({}),
    execute: seguro(async () => {
      const franjas = await misFranjas();
      return {
        franjas: franjas.map((f) => ({
          dia: DIAS[f.dia_semana],
          desde: f.hora_desde,
          hasta: f.hora_hasta,
        })),
      };
    }),
  });

  // El catálogo del rol ES la matriz de guards de las pantallas — el asistente
  // nunca sabe más que las pantallas del rol.
  return {
    buscar_gestiones,
    detalle_gestion,
    gestiones_archivadas,
    mis_pendientes,
    mis_notificaciones,
    sugerir_navegacion,
    ...(esStaff && { resumen_tablero, metricas_negocio }),
    ...(veCartera && { consultar_cartera, historial_propiedad }),
    ...(veTecnicos && { ranking_tecnicos, detalle_tecnico, inbox_reportes }),
    ...(esAdmin && { auditoria_reciente, equipo_interno }),
    ...(rol === "tecnico" && { mi_agenda }),
  };
}

export type RolAsistente = Rol;
