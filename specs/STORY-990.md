# STORY-990 — Encabezados de página consistentes (título + subtítulo, sin jerga) (v1.0)

**Estado:** ✅ done · **Origen:** Fausti (UX): los encabezados de cada sección eran inconsistentes (la "palabrita gris" de arriba a veces era categoría, a veces jerga —"Funnel", "Mantenedor", "Trazabilidad"—, a veces una descripción larga; algunas páginas tenían subtítulo y otras no) y en algunos casos demasiado técnicos para el usuario final ("event log", "timestamps", "Casilla de reportes con 'mantenimiento' en el asunto").

## Regla única (aprobada por Fausti)

Cada página de staff usa **Título + una frase corta debajo**, y se **elimina la palabrita gris de arriba** (el rótulo/volanta). El **título pasa a ser el nombre del ítem del menú** (clickeás "Tablero" → dice "Tablero"). Sin jerga técnica; voseo rioplatense.

Estructura común:
```tsx
<div className="mb-5">
  <div className="flex items-start justify-between gap-4">
    <h1 className="text-2xl font-semibold tracking-tight">{título}{badge?}</h1>
    {acción a la derecha?}
  </div>
  <p className="text-sm text-muted mt-1">{subtítulo}</p>
</div>
```

## Copy final

| Página | Título | Subtítulo |
|---|---|---|
| Tablero | Tablero | Seguí cada mantenimiento por su etapa, del reporte a la liquidación. |
| Inbox | Inbox | Los correos que llegan pidiendo un mantenimiento, listos para convertir en gestión. |
| Administración | Administración | Los edificios y las propiedades que administra la inmobiliaria. |
| Finanzas | Finanzas | Lo que falta cobrar y lo que ya se cerró, en un solo lugar. |
| Técnicos | Técnicos | La red de técnicos: especialidades, desempeño y solicitudes nuevas. |
| Archivo | Archivo | Las gestiones cerradas o canceladas, para consultarlas cuando haga falta. |
| Auditoría | Auditoría | Quién hizo qué y cuándo en todo el sistema. |
| Empleados | Empleados | Las cuentas del personal y qué puede hacer cada uno. |
| Especialidades | Especialidades | Los rubros de trabajo que se le pueden asignar a un técnico. |

Notas: se conservan los adornos existentes del título — el contador `· N` del Inbox y el badge de solicitudes pendientes de Técnicos. El subtítulo de Auditoría dice "en todo el sistema" (no "en cada gestión") porque audita acciones de todo el sistema, no solo de gestiones (corrección de Fausti).

## Fuera de alcado

- No se toca la lógica de cada página, solo el encabezado.
- El header del técnico (mobile, sin sidebar) no cambia.

## Criterios de aceptación

1. Las 9 páginas tienen el mismo patrón: título (= nombre del menú) + una frase corta debajo, sin la palabrita gris de arriba.
2. Nada de jerga técnica en los encabezados.
3. Se mantienen el contador del Inbox y el badge de Técnicos, y los botones de acción a la derecha (Nueva gestión / Nuevo empleado / etc.).
4. `tsc`/eslint verdes.

## Dev Agent Record

- **Commit:** _(pendiente de push)_
- **Archivos:** los 9 encabezados (`tablero`, `inbox`, `cartera/propiedades`, `finanzas`, `tecnicos`, `gestiones/archivadas`, `auditoria`, `empleados`, `especialidades` .client.tsx) + el back-link "← Administración" en `app/cartera/propiedades/[id]/page.tsx`.
- **Verificación:** `tsc`/eslint verdes; no quedan rótulos viejos (grep) salvo comentarios. Spot-check en el navegador: Tablero ("Tablero" + botón + "Seguí cada mantenimiento…") y Auditoría ("Auditoría" + "Quién hizo qué y cuándo en todo el sistema").
