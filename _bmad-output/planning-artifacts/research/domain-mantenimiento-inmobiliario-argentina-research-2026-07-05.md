---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - specs/PRD.md
  - _bmad-output/planning-artifacts/research/market-gestion-mantenimiento-inmobiliario-research-2026-07-05.md
workflowType: 'research'
lastStep: 1
research_type: 'domain'
research_topic: 'Dominio de la gestión de mantenimiento inmobiliario en Argentina'
research_goals: 'Marco legal de reparaciones inquilino vs propietario; prácticas operativas de administradoras; taxonomía de especialidades; documentación de respaldo del sector; facturación (monotributo, a quién se factura) — para alimentar el PRD y los mantenedores de MANTIS 2'
user_name: 'Fausti'
date: '2026-07-05'
web_research_enabled: true
source_verification: true
---

# Research Report: domain

**Date:** 2026-07-05
**Author:** Fausti
**Research Type:** Domain Research

---

## Research Overview

Investigación del dominio de gestión de mantenimiento inmobiliario en Argentina para **MANTIS 2**: marco legal de reparaciones (CCyC post-DNU 70/2023), operatoria real de administradoras (honorarios, liquidación mensual, circuito con técnicos), taxonomía de especialidades para el mantenedor, documentación de respaldo del sector (actas de entrega/conformidad) y circuito de facturación con técnicos monotributistas.

**Hallazgos clave:** (1) la regla "quién paga" es supletoria del CCyC y depende de la causa del deterioro y del contrato — el sistema debe sugerir, no imponer; (2) los plazos legales (24h urgente / 10 días normal) dan semántica objetiva al campo urgencia; (3) el cobro al propietario en la práctica se descuenta de la liquidación mensual; (4) el "Resumen de obras" complementa el acta de entrega/devolución estándar del sector; (5) WhatsApp es el canal real del mercado argentino — dejar el inbox extensible.

Las 8 decisiones de producto derivadas están en la sección final "Síntesis".

---

## Research Initialization

### Alcance confirmado

**Dominio**: gestión de mantenimiento de propiedades en alquiler administradas por inmobiliarias, Argentina.

**Ejes de investigación (definidos por Fausti):**
1. Marco legal de responsabilidades de reparación inquilino vs propietario (CCyC post-DNU 70/2023)
2. Prácticas operativas reales de administradoras (técnicos, presupuestos, comprobantes, liquidaciones)
3. Taxonomía estándar de especialidades/categorías de mantenimiento
4. Documentación de respaldo del sector (actas de conformidad, resumen de obras, devolución de propiedad)
5. Facturación en Argentina (técnicos monotributistas, a quién se factura)

**Propósito**: alimentar el PRD v1.0.0 y el diseño de los mantenedores del sistema.

**Nota**: el análisis competitivo NO se repite acá — ya está en `market-gestion-mantenimiento-inmobiliario-research-2026-07-05.md`.

**Research Status**: Scope confirmado por el usuario al invocar el workflow (2026-07-05).

---

## Análisis del Dominio: Operatoria de Administradoras de Alquileres en Argentina

### Estructura del servicio de administración

- **Honorarios de administración**: entre **3% y 10% del alquiler mensual** según provincia, tipo de propiedad y servicios incluidos (rango típico citado: 3–6% del valor del contrato, o 8–10% en servicio integral). Se calculan **sobre el alquiler puro**, nunca sobre expensas, ABL ni otros gastos ([MercadoLibre blog](https://www.mercadolibre.com.ar/blog/re-inmobiliaria-comision-para-alquiler-cuanto-cobra-una-inmobiliaria-por-administrar-una-propiedad), [La Nación 2025](https://www.lanacion.com.ar/propiedades/casas-y-departamentos/cuanto-cobra-una-inmobiliaria-por-administrar-un-alquiler-nid27062025/), [Grupo Estia](https://grupoestia.com/administracion-y-gestion-de-alquileres-en-argentina/)).
- **Servicios incluidos** en la administración integral: cobro mensual y transferencia al propietario, **control de mantenimiento (coordinación de reparaciones)**, **rendición contable** (reporte de cobros y gastos), renovaciones/rescisiones, y representación ante reclamos e inspecciones ([Grupo Estia](https://grupoestia.com/administracion-y-gestion-de-alquileres-en-argentina/)). → El mantenimiento es uno de los 3 servicios centrales por los que el propietario paga la administración.

### La liquidación mensual al propietario (documento pivote del dominio)

La **liquidación inmobiliaria** es el documento formal que rinde al propietario: alquiler cobrado, ajustes, **gastos descontados (reparaciones incluidas)** y saldo transferido ([Dileo Inmuebles](https://dileoinmuebles.com.ar/comprobante-alquiler-recibo-y-liquidacion-inmobiliaria/)).

**Implicancia directa para MANTIS 2**: cuando una obra la paga el **propietario**, en la práctica argentina el cobro no suele ser "facturar y esperar el pago" — se **descuenta de la liquidación mensual del alquiler**. El funnel debe contemplar ambos mecanismos de cobro al propietario: (a) descuento en liquidación (el caso común), (b) cobro directo (obras grandes que exceden el alquiler del mes). Para el inquilino, el cobro sí es directo (transferencia/efectivo) o junto con el alquiler del mes siguiente.

### Taxonomía de especialidades (seed para el mantenedor)

Los oficios estándar del mantenimiento edilicio residencial en Argentina ([Formación MVL](https://formacion.mvl.edu.ar/curso-mantenimiento-de-edificios/), [Campus Norte UNC](https://campusnorte.unc.edu.ar/modulos/iniciacion-a-la-construccion-y-mantenimiento-edilicio/)):

| Especialidad | Requiere matrícula | Notas |
|---|---|---|
| Plomería / sanitarios | No (salvo obra) | Incluye destapaciones, griferías, flexibles |
| **Gas** | **SÍ — gasista matriculado obligatorio** | Único autorizado a intervenir instalaciones; deja certificado |
| **Electricidad** | Depende jurisdicción (ej. ERSeP Córdoba exige instalador habilitado) | ([ERSeP](https://ersep.cba.gov.ar/queres-ser-instalador-electrico-habilitado/)) |
| Albañilería | No | Humedad, revoques, filtraciones |
| Pintura / impermeabilización | No | |
| Carpintería | No | Aberturas, muebles, cerraduras de madera |
| Herrería / cerrajería | No | Rejas, portones, cerraduras |
| Climatización (split, calefacción) | Matrícula frío/calor recomendada | Instalación y service de split, calderas, termotanques, calefones |
| Techista / zinguería | No | Goteras, membranas |
| Vidriería | No | |
| Fumigación / control de plagas | Habilitación municipal | |
| Espacios verdes / limpieza | No | Mantenimiento preventivo |

**Implicancia para el mantenedor de especialidades**: incluir el flag **"requiere matrícula"** por especialidad → se conecta con la documentación exigida al técnico en el enrolamiento (matrícula además de DNI/seguro cuando la especialidad lo exige).

### Dinámica del trabajo con técnicos

Del relevamiento operativo (fuentes anteriores + prácticas descriptas por las propias administradoras): el circuito real es **reclamo → visita de inspección/presupuesto → aprobación de quien paga → ejecución → conformidad → rendición**. Los técnicos suelen ser cuentapropistas (monotributistas) de confianza de la inmobiliaria, no empleados — coincide con el modelo de enrolamiento con documentación de MANTIS 2 (el detalle fiscal se profundiza en la sección regulatoria).

_Confianza: alta en honorarios/liquidación (múltiples fuentes coincidentes); media en la tabla de especialidades (compilación propia a partir de programas de formación de oficios — validar con la inmobiliaria usuaria)._

---

## Panorama Competitivo

Cubierto en profundidad en el documento hermano: [`market-gestion-mantenimiento-inmobiliario-research-2026-07-05.md`](market-gestion-mantenimiento-inmobiliario-research-2026-07-05.md) (jugadores globales y argentinos, posicionamiento, fortalezas/debilidades, manejo de comunicación sin acceso al sistema, uso de IA y oportunidades de diferenciación). No se duplica aquí.

---

## Marco Regulatorio y Legal

### Quién paga cada reparación (la regla de negocio central del sistema)

**Régimen vigente 2026**: el DNU 70/2023 derogó la Ley de Alquileres 27.551; la locación se rige por el **Código Civil y Comercial + libertad contractual**. Las reglas del CCyC sobre reparaciones son **supletorias**: aplican salvo pacto en contrario en el contrato, siempre que lo pactado no sea abusivo ([Muovi 2026](https://www.muovi.com.ar/guias/ley-alquileres-2026-quien-paga-reparaciones), [Grupo Professional](https://www.grupoprofessional.com.ar/blog/dnu-70-2023-cuales-son-los-cambios-en-los-contratos-de-locacion-de-inmuebles-dr-santiago-j-miani/), [Microjuris](https://aldiaargentina.microjuris.com/2023/12/29/doctrina-los-contratos-de-locacion-inmobiliaria-en-el-dnu-70-2023/)).

Regla supletoria del CCyC:

| Caso | Paga | Base legal |
|---|---|---|
| Deterioro por desgaste, antigüedad, defecto o vicio de la cosa | **Propietario (locador)** | art. 1201 CCyC — debe conservar la cosa apta para el uso convenido |
| Deterioro causado por culpa del inquilino o personas a su cargo | **Inquilino (locatario)** | arts. 1206/1207 CCyC |
| Mejoras/mantenimiento menor de mera conservación por uso normal | Habitualmente **inquilino** (según contrato) | práctica contractual |

**Reparaciones urgentes**: si el locador no responde en **24 horas corridas** desde la notificación fehaciente, el inquilino puede hacerla por sí **con cargo al locador**. No urgentes: intimación con plazo mínimo de **10 días corridos** ([Estudio Vilaplana](https://estudiovilaplana.com.ar/gastos-reparaciones-alquiler-inmueble/), [Muovi](https://www.muovi.com.ar/guias/reparaciones-urgentes-alquiler-derechos-inquilino)).

**Implicancias de diseño para MANTIS 2:**
1. El campo `paga: inquilino|propietario` no puede tener un default fijo — depende de la **causa** del deterioro y de **lo que diga cada contrato**. Sugerencia: la IA/gestor clasifica la causa (desgaste vs daño) y el sistema sugiere el pagador; el gestor confirma.
2. Los **plazos legales (24h urgente / 10 días)** justifican el campo de **urgencia** y dan un SLA objetivo: una gestión urgente sin asignación en horas es un riesgo legal para el propietario, no solo mala atención. Métrica/alerta de valor.
3. El registro fehaciente de fechas (reporte, notificación, resolución) que produce el event log de MANTIS 2 sirve como **evidencia** en conflictos — valor agregado directo de la trazabilidad.

### Facturación (eje 5)

- Los técnicos cuentapropistas son típicamente **monotributistas** → emiten **factura electrónica tipo "C"** obligatoria en todas las categorías ([ARCA](https://www.afip.gob.ar/inmuebles/alquileres/propietarios/facturacion.asp), [2clics](https://2clics.app/factura-electronica-alquileres/)).
- La factura del técnico se emite a quien paga la obra (propietario o inquilino); cuando interviene la inmobiliaria, la práctica recomendada es que ésta facture **solo su comisión/gastos administrativos** y actúe "por cuenta y orden" del propietario en el resto ([ARCA](https://www.afip.gob.ar/inmuebles/alquileres/propietarios/facturacion.asp), [Eve Muriel](https://evemuriel.com/blog/tramites/tratamiento-impositivo-alquileres-2018.html)).
- **Implicancia**: el documento que MANTIS 2 envía por email al inquilino/propietario es un **detalle de obra/nota de cobro de la inmobiliaria**, que adjunta o referencia la factura C del técnico — el sistema no reemplaza la facturación fiscal (ARCA) sino que la documenta. La "liquidación al técnico" registra contra qué factura C se le pagó. _Confianza: media — validar el circuito fiscal exacto con el contador de la inmobiliaria._

### Documentación de respaldo del sector (eje 4)

- **Acta de entrega / devolución del inmueble**: inventario del estado de la propiedad (paredes, pisos, aberturas, instalaciones eléctrica/gas/sanitaria) firmado por ambas partes al inicio y al fin del contrato; la comparación entre ambas define responsabilidades por daños ([Roomix 2026](https://roomix.ai/blog/que-es-acta-de-entrega), [Wonder.Legal](https://www.wonder.legal/ar/modele/recibo-inmueble-alquilado)). No es obligatoria por ley pero es práctica estándar ([Roomix](https://roomix.ai/blog/modelo-acta-entrega-alquiler-descargar-2026)).
- **Encaje perfecto con el legajo de MANTIS 2**: el "Resumen de obras" por período de inquilino es el complemento natural del acta de devolución — documenta qué se reparó durante la ocupación y respalda la verificación del vendedor al recibir llaves (caso de uso ya previsto en el PRD §8). Sugerencia: incluir en el PDF la comparación implícita "obras realizadas durante el período + estado final por gestión (conformidad firmada)".
- **Acta de conformidad de obra firmada por el inquilino** (heredada del MANTIS original como foto de conformidad): en este dominio funciona como el equivalente por-obra del acta de devolución — evidencia de que la reparación se hizo y quedó OK.

_Confianza: alta en el marco legal (fuentes jurídicas coincidentes); media en prácticas de facturación (requiere validación contable)._

---

## Tendencias Técnicas del Dominio

Las tendencias tecnológicas globales (IA de triage, mobile-first, agentes) están relevadas en el documento de market research. Hallazgo adicional específico del dominio argentino:

**WhatsApp es el canal real de comunicación inquilino↔inmobiliaria en Argentina** — hasta los organismos públicos de atención a inquilinos operan por WhatsApp ([DIB 2025](https://dib.com.ar/2025/03/inquilinos-linea-de-whatsapp-para-consultas-sobre-contratos-derechos-obligaciones-expensas)), y el ecosistema local ya integra WhatsApp + IA a sistemas inmobiliarios para trazabilidad de conversaciones ([2clics](https://2clics.app/whatsapp/), [Potenzzia](https://www.potenzzia.com/blog/whatsapp-e-inteligencia-artificial-aplicado-en-inmobiliarias)).

**Implicancia**: el PRD define Gmail como canal exclusivo de reportes (canal oficial actual de la inmobiliaria — decisión correcta para v1). Pero es esperable que muchos reclamos reales sigan llegando por WhatsApp al gestor. Recomendación: (a) diseñar `inbox_reportes` con campo `canal` (email | manual | whatsapp-futuro) para no cerrar la puerta, y (b) en v2 evaluar WhatsApp Business API como segunda fuente del mismo inbox. El flujo aguas abajo (IA → card en Kanban) no cambia.

---

## Síntesis: Decisiones de Producto Derivadas del Dominio

Consolidado accionable de esta investigación para el PRD y los mantenedores:

1. **Mantenedor de especialidades — seed inicial**: Plomería, Gas (matriculado), Electricidad, Albañilería, Pintura/Impermeabilización, Carpintería, Herrería/Cerrajería, Climatización, Techos/Zinguería, Vidriería, Control de plagas, Otros. Con flag **`requiere_matricula`** que condiciona la documentación exigida en el enrolamiento del técnico.
2. **Campo `urgencia`** (normal | urgente) con semántica legal: urgente = riesgo a las 24h; normal = plazo de 10 días. Alertas del sistema alineadas a esos plazos.
3. **Campo `causa`** del deterioro (desgaste/antigüedad | daño por uso | mejora) como input para sugerir el pagador según regla CCyC supletoria + lo pactado en contrato. El gestor siempre confirma.
4. **Cobro al propietario con dos mecanismos**: descuento en liquidación mensual del alquiler (caso común) o cobro directo. La entidad `cobros` debe modelar ambos.
5. **La factura del sistema es una nota de cobro/detalle de obra de la inmobiliaria**, que referencia la factura C del técnico monotributista. La liquidación al técnico registra contra qué factura C se pagó. (Validar circuito con el contador.)
6. **El PDF "Resumen de obras" debe dialogar con el acta de entrega/devolución**: es su complemento documental y el respaldo del caso de uso "vendedor recibe llaves y verifica reparaciones".
7. **`inbox_reportes.canal`** extensible (email | manual | whatsapp futuro).
8. **El event log con timestamps fehacientes es evidencia legal**, no solo trazabilidad — comunicarlo así al administrador (valor del módulo de auditoría).

---

**Domain Research Completion Date:** 2026-07-05
**Source Verification:** afirmaciones citadas con fuentes; confianza explícita por sección
**Confidence Level:** Alto en marco legal y operatoria de administración; medio en facturación fiscal y taxonomía (validar con contador e inmobiliaria)
