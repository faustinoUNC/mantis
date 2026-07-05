---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - specs/PRD.md
  - specs/ARQUITECTURA.md
workflowType: 'research'
lastStep: 1
research_type: 'market'
research_topic: 'Software de gestión de mantenimiento para inmobiliarias (property maintenance management)'
research_goals: 'Analizar competencia (Property Meld, Latchel, Fixflo, TenantCloud, Buildium, AppFolio y equivalentes LATAM/Argentina) en el flujo reporte→asignación→ejecución→facturación; comunicación con inquilinos/propietarios sin acceso al sistema; uso de IA; aprendizajes para el funnel Kanban de MANTIS 2'
user_name: 'Fausti'
date: '2026-07-05'
web_research_enabled: true
source_verification: true
---

# Research Report: market

**Date:** 2026-07-05
**Author:** Fausti
**Research Type:** Market Research

---

## Research Overview

Investigación de mercado y competencia para **MANTIS 2**, el sistema de gestión de mantenimiento inmobiliario que evoluciona el MANTIS original. Se relevaron los líderes globales maintenance-first (Property Meld, Latchel, Fixflo), la ola de IA agéntica (Vendoroo, Mezo/MAX™, AppFolio Realm-X), las suites all-in-one (Buildium, AppFolio) y el software inmobiliario argentino (Xintel, Inmosoft, Barreeo, BCS Data), con fuentes verificadas de 2025-2026.

**Hallazgos clave:** (1) el mantenimiento es el factor #1 de retención de propietarios e inquilinos para una administradora; (2) el mercado argentino no tiene ningún producto que gestione el flujo operativo de mantenimiento — las suites locales solo registran gastos; (3) el patrón dominante global valida el modelo MANTIS 2: intake sin credenciales (teléfono/SMS/email/foto) + updates salientes automáticos, sin darle login al inquilino ni al propietario; (4) las debilidades más citadas de los líderes (mobile pobre para técnicos, facturación desconectada, complejidad) son exactamente los diferenciales planificados de MANTIS 2.

La síntesis estratégica y las recomendaciones accionables para el PRD están en la sección final.

---

# Market Research: Software de gestión de mantenimiento para inmobiliarias

## Research Initialization

### Research Understanding Confirmed

**Topic**: Software de gestión de mantenimiento inmobiliario (property maintenance management) para inmobiliarias/administradoras
**Goals**:
1. Mapear qué ofrece la competencia en el flujo completo: reporte → triage/clasificación → asignación de técnico → ejecución/seguimiento → conformidad → facturación/cobro → liquidación
2. Entender cómo manejan la comunicación con inquilinos y propietarios **sin darles acceso al sistema** (email, WhatsApp, SMS, portales opcionales)
3. Relevar el uso de IA en el sector (triage automático, clasificación, scheduling)
4. Extraer aprendizajes concretos para el funnel Kanban y el modelo de dominio de MANTIS 2

**Research Type**: Market Research
**Date**: 2026-07-05

### Research Scope

**Competidores objetivo:**
- Especialistas en mantenimiento: Property Meld, Latchel, Fixflo, Mezo, Vendoroo
- Suites de property management con módulo de mantenimiento: Buildium, AppFolio, TenantCloud, DoorLoop, Rentvine
- LATAM/Argentina: equivalentes locales (a descubrir en la investigación)

**Foco geográfico**: global (EE.UU./UK como mercados maduros de referencia) + LATAM/Argentina como mercado objetivo real de MANTIS 2.

**Propósito de negocio**: informar el diseño del producto (PRD v1.0.0) antes de construir — no es un análisis para inversión ni market entry comercial.

**Research Methodology:**
- Datos web actuales con verificación de fuentes
- Múltiples fuentes independientes para afirmaciones críticas
- Nivel de confianza explícito para datos inciertos
- Cobertura completa sin gaps críticos

### Next Steps

**Research Workflow:**

1. ✅ Inicialización y alcance (este paso)
2. Insights y comportamiento del cliente (inmobiliarias/administradoras)
3. Pain points del cliente
4. Decisiones de compra del cliente
5. Análisis competitivo
6. Síntesis estratégica y recomendaciones

**Research Status**: Scope confirmado por el usuario en el brief inicial (2026-07-05) — el alcance fue definido textualmente por Fausti al invocar el workflow.

---

## Customer Behavior and Segments

> **Nota metodológica:** el "cliente" de este análisis es la **inmobiliaria/administradora de propiedades** (compradora del software). Inquilinos, propietarios y técnicos son stakeholders del flujo, no compradores.

### Patrones de comportamiento del cliente

Las administradoras operan el mantenimiento como un flujo **reactivo por eventos**: entra un reclamo (email, teléfono, WhatsApp), alguien lo triagea, se asigna un proveedor/técnico, se ejecuta, se documenta y se cobra. La nueva generación de software conecta ese flujo fragmentado con datos estructurados, automatización y visibilidad en tiempo real "from request to invoice" — exactamente el arco que MANTIS 2 modela como funnel. ([Lula, 2026](https://lula.life/articles/best-property-management-maintenance-software))

_Drivers de comportamiento:_ el mantenimiento es el servicio más crítico de la relación: quienes están satisfechos con el mantenimiento son **146% más propensos a recomendar** a la administradora y **71% más propensos a renovar** el contrato de alquiler ([AppFolio Benchmark Report 2025](https://naahq.org/flat-rents-ai-adoption-2025-appfolio-property-management-benchmark-report-reveals-key-trends)). Para los propietarios, el mantenimiento es la **principal fuente de estrés (38%)** — más que vacancia o cobranza — y el **56% contrata una administradora justamente para delegar el mantenimiento** ([Buildium/NARPM 2026](https://www.buildium.com/blog/2026-property-management-industry-trends/)).

_Adopción de tecnología:_ el uso de IA en administradoras **se triplicó de ~20% a 58% en un año** ([Buildium 2026](https://www.buildium.com/blog/2026-property-management-industry-trends/)); en 2025 los usos principales eran comunicación con residentes (60%), gestión de órdenes de trabajo (17%) y carga de datos (21%) ([AppFolio 2025](https://naahq.org/flat-rents-ai-adoption-2025-appfolio-property-management-benchmark-report-reveals-key-trends)). El mercado espera "mobile-first everything" para el personal de campo y triage inteligente de solicitudes ([SafetyCulture 2026](https://safetyculture.com/apps/property-maintenance-software)).

_Hábitos de decisión:_ el mercado se divide en dos comportamientos de compra: (a) suites all-in-one (AppFolio, Buildium, DoorLoop) donde mantenimiento es un módulo más junto a contabilidad y leasing, y (b) soluciones **maintenance-first** (Property Meld, Latchel) para quienes el cuello de botella es la operación de mantenimiento ([Lula](https://lula.life/articles/best-property-management-maintenance-software), [DoorLoop](https://www.doorloop.com/blog/best-property-management-maintenance-software)). MANTIS 2 cae en la categoría maintenance-first.

### Segmentación (proxy demográfico B2B)

- **Tamaño de cartera**: micro (<100 unidades, gestión por planilla/WhatsApp), medianas (100–1.000, el sweet spot de las maintenance-first), grandes (>1.000, suites enterprise). La inmobiliaria destinataria de MANTIS 2 es del segmento micro/mediano.
- **Modelo de ejecución**: técnicos propios, red de proveedores externos, o híbrido. La tendencia recomendada es híbrida: tareas rutinarias in-house y especializadas tercerizadas; un 15% planea internalizar mantenimiento para bajar costos ([Buildium 2026](https://www.buildium.com/blog/maintenance-as-a-competitive-advantage/)).
- **Geografía**: en EE.UU./UK el mercado está maduro y saturado de features; en **Argentina/LATAM el software inmobiliario dominante (Xintel, Inmosoft, Barreeo, BCS Data) está centrado en contratos, expensas y liquidaciones — el mantenimiento aparece como registro de gastos, no como flujo operativo con técnicos, estados y conformidades** ([Barreeo](https://barreeo.com/), [Inmosoft](https://www.inmosoft.com.ar/), [BCS Data](https://bcsdata.com/software-alquiler-argentina-buenos-aires), [ComparaSoftware AR](https://www.comparasoftware.com.ar/software-inmobiliario)). **Gap de mercado claro para MANTIS 2.**

### Perfiles psicográficos (roles internos)

- **Dueño/administrador de la inmobiliaria**: valora control, trazabilidad y respaldo documental frente a propietarios (el PDF "Resumen de obras" ataca directo esta necesidad). Desconfía de sistemas complejos; quiere ver el negocio de un vistazo.
- **Gestor operativo**: vive en el triage; su métrica es velocidad de resolución y no perder ningún reclamo. Necesita inbox unificado y asignación sin fricción.
- **Administrativo/finanzas**: piensa en quién paga cada obra (inquilino vs propietario), facturación y liquidaciones. Su dolor es reconstruir el detalle de la obra al momento de facturar.
- **Técnico de campo**: trabaja desde el celular, tolerancia cero a formularios largos; si el sistema le complica la vida, vuelve a WhatsApp. Los líderes del mercado invierten en "mobile-first field interfaces" ([Oxmaint 2026](https://oxmaint.com/industries/property-management/complete-guide-property-maintenance-management-software-2026)).

### Drivers e influencias

- _Emocionales:_ reducir el estrés del propietario (38% lo declara su mayor estrés) y el miedo del administrador a "perder" un reclamo que escala a conflicto.
- _Racionales:_ costos de contratistas (HVAC, plomería, electricidad) subieron **15–25% desde 2022** → presión por presupuestos claros y comparables ([Buildium 2026](https://www.buildium.com/blog/2026-property-management-industry-trends/)). Un 40% de inquilinos indecisos renovaría si se invirtiera más en mantenimiento — retención directa.
- _Sociales:_ la recomendación boca a boca entre propietarios es el principal canal de crecimiento de una inmobiliaria; el respaldo documental del mantenimiento alimenta esa reputación.
- _Económicas:_ personal limitado y altos volúmenes de órdenes; el mantenimiento reactivo es señalado como el workflow que más tiempo/dinero desperdicia ([Building Engines 2025](https://www.buildingengines.com/wp-content/uploads/2024/12/The-state-of-commercial-property-management-technology-2025.pdf)).

### Patrones de interacción

- _Descubrimiento:_ comparadores (Capterra, ComparaSoftware en AR), recomendación entre colegas de NARPM/cámaras inmobiliarias.
- _Proceso de compra:_ demo → prueba con parte de la cartera → migración. Baja tolerancia a implementaciones largas en el segmento micro/mediano.
- _Post-compra:_ el mayor riesgo de churn es que **los actores externos (técnicos/vendors) no adopten el sistema** — la fricción del lado del proveedor es el eslabón débil reportado ([Building Engines 2025](https://www.buildingengines.com/wp-content/uploads/2024/12/The-state-of-commercial-property-management-technology-2025.pdf)). Refuerza la decisión de MANTIS 2 de hacer la vista técnico impecable en mobile.

_Confianza: alta en tendencias EE.UU. (informes AppFolio/Buildium con muestras grandes); media en afirmaciones sobre Argentina (basadas en features públicos de los productos locales, no en estudios de mercado formales)._

---

## Customer Pain Points and Needs

### Desafíos y frustraciones principales

_Reclamos que se pierden:_ cuando los reportes de inquilinos entran por llamadas, emails o mensajes sueltos, **se pierden pedidos, se responde tarde y se duplican reclamos** — es la frustración número 1 documentada del flujo sin sistema ([Snapfix](https://snapfix.com/property-management), [Coast 2026](https://coastapp.com/blog/property-management-work-order-software/)). Más del **70% de las quejas de inquilinos son por mantenimiento o seguridad** ([Coast](https://coastapp.com/blog/property-maintenance-software/)). Esto valida directamente el inbox Gmail→sistema de MANTIS 2.

_Coordinación con técnicos/vendors:_ mala coordinación, estándares inconsistentes entre propiedades y falta de información al técnico ("vendors often not given enough information") son quejas recurrentes incluso en los líderes del mercado ([Capterra — Property Meld reviews](https://www.capterra.com/p/149045/Property-Meld/reviews/)).

_Mobile deficiente para el técnico:_ patrón repetido en los reviews de los líderes — **la app mobile es limitada frente a la versión desktop y frustra a los técnicos en campo** (Property Meld, eMaint) ([Coast 2026](https://coastapp.com/blog/property-management-work-order-software/)). El punto débil de la competencia es exactamente lo que MANTIS 2 define como requisito crítico.

_Excel/WhatsApp en Argentina:_ en el mercado local la operatoria se resuelve con **planillas de Excel, controles manuales y validaciones "a ojo"**, con impacto directo en caja y en la credibilidad ante propietarios ([Gema Roja](https://gemaroja.com.ar/blog/errores-de-icl-e-ipc-al-ajustar-alquileres-como-evitarlos/)); la gestión de reclamos por WhatsApp sin registro estructurado es la norma ([Barreeo blog](https://barreeo.com/blog/a-quien-le-reclamo-consorcio-vs-inmobiliaria-ejemplos/)).

### Necesidades no cubiertas (gaps de solución)

1. **Flujo de mantenimiento operativo completo en LATAM**: los sistemas argentinos registran gastos de reparación pero no gestionan el ciclo técnico (asignación → presupuesto → ejecución → conformidad → liquidación). Gap central que MANTIS 2 ataca.
2. **Facturación integrada al flujo**: incluso Property Meld obliga a **crear facturas manualmente** cuando se usa mantenimiento in-house, y los rubros contables no sincronizan ([Capterra reviews](https://www.capterra.com/p/149045/Property-Meld/reviews/)). Tener factura/cobro/liquidación como columnas del mismo funnel es un diferencial real.
3. **Respaldo documental por propiedad/inquilino**: no se encontró en la competencia relevada un equivalente al "Resumen de obras" por legajo — el historial suele ser por work order, no consolidado por período de ocupación. Diferenciador potencial de MANTIS 2 (confianza media: puede existir como reporte custom en suites enterprise).
4. **Claridad de responsabilidad de pago (inquilino vs propietario)**: en Argentina la confusión sobre a quién corresponde cada arreglo es fuente constante de conflicto ([MercadoLibre blog](https://www.mercadolibre.com.ar/blog/re-sc-que-arreglos-le-corresponden-al-inquilino-en-argentina), [ADCOIN](https://www.adcoin.org.ar/2024/09/codigo-de-buenas-practicas-entre.html)) — el campo explícito "paga: inquilino|propietario" definido en etapa Presupuesto formaliza esa decisión y deja rastro.

### Barreras de adopción

- _Precio:_ los líderes cobran por unidad con mínimos (~US$1,60/unidad, mínimo US$160/mes en Property Meld) + contratos anuales con penalidad ([Capterra](https://www.capterra.com/p/149045/Property-Meld/)) — inviable para inmobiliarias chicas de LATAM.
- _Complejidad de implementación:_ 4–8 semanas típicas, hasta 12+ en despliegues grandes; los usuarios reportan que "creó más trabajo en lugar de menos" cuando la integración es mala ([SelectHub](https://www.selecthub.com/p/facility-management-software/property-meld/), [Capterra reviews](https://www.capterra.com/p/149045/Property-Meld/reviews/)).
- _Adopción de terceros:_ si técnicos e inquilinos odian la plataforma, el sistema muere — reviews reportan "vendors and tenants hated the platform" ([GetApp](https://www.getapp.com/real-estate-property-software/a/property-meld/reviews/)). MANTIS 2 elimina la mitad de esta barrera por diseño: inquilinos/propietarios no usan el sistema; solo hay que ganarse al técnico.

### Priorización de pain points (impacto para MANTIS 2)

| # | Pain point | Severidad | Cómo lo ataca MANTIS 2 |
|---|---|---|---|
| 1 | Reclamos perdidos / triage manual | Alta | Inbox Gmail exclusivo + IA que crea la card |
| 2 | Mobile pobre para el técnico | Alta | Vista técnico mobile-first (requisito crítico) |
| 3 | Facturación desconectada de la obra | Alta | Facturación/cobro/liquidación como etapas del funnel |
| 4 | Falta de respaldo documental ante propietario | Media-alta | Legajos + PDF "Resumen de obras" |
| 5 | Confusión inquilino-vs-propietario sobre quién paga | Media-alta | Campo obligatorio "paga" en etapa Presupuesto |
| 6 | Complejidad/implementación pesada | Media | Dominio reducido, funnel simple de 8 columnas |

_Confianza: alta — los pain points de producto salen de reviews verificados (Capterra/GetApp/SoftwareAdvice); los de Argentina, de fuentes locales de calidad media._

---

## Customer Decision Processes and Journey

### Proceso de decisión de compra (referencia de mercado)

- _Etapas:_ dolor operativo → búsqueda en comparadores/recomendación de colegas → demo/trial (14 días sin tarjeta es el estándar: Buildium, Oxmaint) → prueba con parte de la cartera → adopción ([Buildium pricing guide](https://www.buildium.com/blog/property-management-software-pricing-guide/), [Oxmaint](https://oxmaint.com/article/property-maintenance-software-guide)).
- _Criterios de evaluación dominantes:_ (1) **costo total de propiedad** — los mínimos mensuales, onboarding pago y módulos aparte castigan a portfolios chicos: "un producto de $1/unidad puede exigir $400 de mínimo + $500 de onboarding" ([RentRedi](https://rentredi.com/blog/property-management-software-pricing-models-explained-flat-fee-vs-per-unit-vs-tiered/), [ShukRentals](https://www.shukrentals.com/learn/topics/property-management-software-comparison)); (2) **capacidad real del workflow de mantenimiento** — segunda fricción más común: plataformas fuertes en cobranza que dejan la coordinación de vendors afuera ([TenantCloud](https://www.tenantcloud.com/property-management/property-management-software-costs)); (3) fit con el tipo de cartera.
- _Relevancia para MANTIS 2:_ al ser un sistema a medida para la inmobiliaria, la "decisión de compra" ya está tomada — pero estos criterios definen el **benchmark de valor**: el sistema debe costar menos operar que un Property Meld (US$160+/mes) y cubrir el workflow completo que las suites locales no tienen.

### Journey operativo (el que importa diseñar) {#journey-operativo}

El journey crítico para MANTIS 2 no es el de compra sino el del **reclamo**, validado contra el flujo estándar del mercado "request to invoice" ([Lula](https://lula.life/articles/best-property-management-maintenance-software)):

1. **Reporte** — inquilino escribe al canal oficial (en el mercado: portal/app/email/SMS; en MANTIS 2: casilla Gmail exclusiva).
2. **Triage** — clasificación por especialidad y urgencia; acá el mercado ya usa IA (ver análisis competitivo).
3. **Asignación** — matching por especialidad + disponibilidad; los líderes muestran calendario del técnico antes de asignar.
4. **Ejecución y seguimiento** — el técnico documenta desde el celular; actualizaciones automáticas a las partes.
5. **Cierre y cobro** — conformidad, factura, cobro, liquidación al proveedor.

_Influencias en cada paso:_ la satisfacción del inquilino se define en los pasos 1–2 (velocidad de primera respuesta) y la del propietario en el 5 (transparencia del costo y respaldo documental) — consistente con los datos de retención de AppFolio/Buildium citados arriba.

_Confianza: alta._

---

## Competitive Landscape

### Jugadores clave

| Competidor | Tipo | Qué hace en el flujo reporte→facturación | Precio |
|---|---|---|---|
| **Property Meld** (+ Mezo/MAX™) | Maintenance-first, líder del segmento SMB | Intake → troubleshooting automatizado → asignación inteligente por especialidad/proximidad/score → scheduling → rating del residente → comparación factura vs presupuesto → scorecard del vendor. Analytics: velocidad mediana de reparación, satisfacción, spend por unidad ([Property Meld](https://propertymeld.com/what-is-ai-maintenance-coordination/), [Second Nature](https://www.secondnature.com/blog/best-property-management-maintenance-software)) | ~US$1,60/unidad, mín. US$160/mes ([Capterra](https://www.capterra.com/p/149045/Property-Meld/)) |
| **Latchel** | Servicio + software (call center 24/7) | Intake por **teléfono/SMS con número dedicado** — respuesta en 60 seg; IA de troubleshooting resuelve **23% de los tickets sin despachar técnico**; llamadas grabadas y documentadas ([Latchel](https://latchel.com/), [features](https://latchel.com/maintenance-support-requests/)) | Por unidad + fee de servicio |
| **Fixflo** (UK) | Maintenance-first, mercado UK/social housing | Reporte **basado en fotos** desde una página web sin login; prompts de autoayuda reducen reportes 20%; triage de emergencias; marketplace de contratistas certificados; todo logueado en un sistema **auditable** ([Fixflo](https://www.fixflo.com/features/reactive-repair-reporting), [Co-pilot](https://www.fixflo.com/features/workflow-management)) | Cotización |
| **Vendoroo** | AI-first (agentes) | Front desk + mantenimiento con agentes IA: intake, triage, troubleshooting, dispatch, scheduling, follow-up con supervisión humana; casos: 80% menos tareas de mantenimiento en 1.200 puertas ([Vendoroo](https://vendoroo.ai/)) | Suscripción por puerta |
| **AppFolio** | Suite all-in-one (enterprise) | Smart Maintenance 24/7 (IA + agentes humanos) por texto/llamada/portal; **Realm-X Maintenance Performer**: IA agéntica que responde, analiza imágenes, prioriza emergencias y despacha ([AppFolio](https://www.appfolio.com/blog/smart-maintenance), [maintenance](https://www.appfolio.com/property-manager/maintenance)) | Por unidad, mínimos altos |
| **Buildium** | Suite all-in-one (SMB) | Work orders integrados a contabilidad; requests por portal residente; reportes a propietarios ([Buildium](https://www.buildium.com/blog/best-property-maintenance-software/)) | Desde ~US$58/mes |
| **Xintel / Inmosoft / Barreeo / BCS Data** (AR) | Suites locales de administración | Contratos, ajustes ICL/IPC, expensas, liquidaciones; mantenimiento = **registro de gastos e historial**, sin flujo operativo de técnicos ni conformidades ([Barreeo](https://barreeo.com/), [Inmosoft](https://www.inmosoft.com.ar/), [Xintel](https://xintel.com.ar/)) | AR$ accesible |

### Posicionamiento competitivo

El mercado global se ordena en tres olas: (1) suites all-in-one donde mantenimiento es un módulo, (2) maintenance-first especializados (Property Meld, Fixflo), y (3) la ola 2025-2026 de **IA agéntica** (Vendoroo, Realm-X, MAX™) que automatiza el triage y la coordinación completa. La consolidación es activa: **Property Meld adquirió Mezo en enero 2025** para sumar su IA ([Mezo](https://www.mezo.io/)). En Argentina/LATAM ninguna de las tres olas llegó al mantenimiento operativo: las suites locales siguen en la ola cero (registro contable). **MANTIS 2 se posiciona como maintenance-first con IA de intake, a medida, en un mercado local vacío.**

### Fortalezas y debilidades relevantes

- **Property Meld** — Fuerte: métricas operativas maduras (speed of repair, vendor scorecard). Débil: mobile limitado para técnicos, facturación in-house manual, implementación 4–8 semanas, contrato anual ([Capterra reviews](https://www.capterra.com/p/149045/Property-Meld/reviews/)).
- **Latchel** — Fuerte: intake multicanal sin fricción (el inquilino NO necesita app ni portal — llama o manda SMS). Débil: es un servicio tercerizado; la inmobiliaria pierde el control directo de la relación.
- **Fixflo** — Fuerte: reporte con fotos sin login + guías de autoayuda que filtran el 20% de los reportes; sistema auditable. Débil: centrado en UK, con marketplace propio que no aplica a redes locales de técnicos.
- **IA agéntica (Vendoroo/Realm-X)** — Fuerte: automatización end-to-end real. Débil: caja negra, requiere volumen para justificarse, y supervisión humana sigue siendo necesaria.
- **Suites AR** — Fuerte: dominan contratos/ajustes/liquidaciones locales (ICL/IPC), precio accesible. Débil: cero flujo de mantenimiento operativo, cero IA, cero mobile para técnicos.

### Cómo maneja la competencia la comunicación sin dar acceso al sistema

Patrón dominante y validación directa del modelo MANTIS 2 (inquilino/propietario sin login):

1. **Intake sin cuenta**: Latchel usa teléfono/SMS dedicado; Fixflo una página de reporte con fotos sin login; AppFolio acepta texto y llamada. Nadie obliga al inquilino a tener credenciales para reportar. → El canal Gmail exclusivo de MANTIS 2 es equivalente y hasta más natural para el mercado argentino (mail + WhatsApp son la norma local).
2. **Updates salientes automáticos**: confirmación de recepción, técnico asignado, visita agendada y cierre se comunican por email/SMS **desde** el sistema, sin que el receptor entre a ningún lado.
3. **Reporting al propietario**: estados de cuenta y reportes por propiedad exportables/enviables (Rentvine, DoorLoop) con historial de work orders y adjuntos ([Rentvine](https://www.rentvine.com/owner-statements), [DoorLoop](https://www.doorloop.com/blog/property-management-report)). Suelen ser financieros por período; **no se encontró un consolidado de obras por período de ocupación del inquilino** como el "Resumen de obras" por legajo — diferenciador de MANTIS 2 (confianza media).

### Qué hace la competencia con IA (benchmark para el botón IA)

- Triage e intake inteligente: clasificación de urgencia + especialidad al momento del reporte (Mezo: "99% de work orders descriptos con precisión"; reduce 30% el tiempo de resolución) ([Mezo](https://eliteai.tools/tool/mezo)).
- Troubleshooting previo: resolver sin técnico (Latchel 23% de tickets; Fixflo −20% de reportes) — **idea rescatable**: la IA de MANTIS 2 puede sugerir "auto-resolución" en la síntesis cuando el reclamo parece trivial.
- De-escalación de falsas emergencias (Mezo: −33% de emergencias).
- Coordinación agéntica completa (Vendoroo, Realm-X) — fuera de alcance v1 de MANTIS 2, pero el diseño con tool `crear_gestion` deja la puerta abierta.

### Amenazas competitivas

- Baja para un sistema a medida: el riesgo real no es un competidor sino **la vuelta a WhatsApp/Excel** si la UX del técnico o del gestor falla (la barrera de adopción #1 documentada).
- Si las suites locales (Xintel, etc.) suman un módulo de mantenimiento operativo decente, erosionarían el diferencial — hoy no hay señales de eso.

### Oportunidades de diferenciación para MANTIS 2

1. **Funnel visible tipo Kanban**: los líderes usan colas/listas de work orders con estados; el tablero visual simple con permisos por columna es una presentación más clara que la de Property Meld (una de sus quejas: "very complex software").
2. **Facturación y liquidación DENTRO del funnel** (los líderes lo tienen desconectado o manual).
3. **Legajo por inquilino + PDF Resumen de obras** (sin equivalente directo relevado).
4. **Decisión explícita inquilino-vs-propietario sobre quién paga**, adaptada a la práctica argentina.
5. **Mobile técnico impecable** — la debilidad más citada de los líderes.
6. **IA de intake desde Gmail** — nadie en el mercado local lo tiene; en el global es el estándar emergente (validado).

_Confianza: alta en features públicos de competidores; media en ausencia de features (afirmar que "nadie tiene X" siempre tiene riesgo de falso negativo)._

---

## Síntesis Estratégica y Recomendaciones para MANTIS 2

> Nota: MANTIS 2 es un sistema a medida para una inmobiliaria, no un producto a comercializar — por eso esta síntesis traduce los hallazgos en **decisiones de producto para el PRD**, no en estrategia de go-to-market.

### Resumen ejecutivo

El diseño planteado en el PRD v1.0.0 queda **validado por el mercado** en sus cuatro apuestas centrales: intake sin credenciales para inquilinos/propietarios, foco maintenance-first, IA en el triage y mobile para el técnico. Además, la investigación revela que las tres quejas más repetidas contra los líderes globales (mobile pobre, facturación desconectada, complejidad) coinciden con lo que MANTIS 2 ya define como requisitos críticos — ejecutarlos bien no es "nice to have", es el diferencial completo del sistema.

### Recomendaciones accionables (a incorporar al PRD)

| # | Recomendación | Origen del hallazgo | Impacto en PRD |
|---|---|---|---|
| 1 | **Medir "speed of repair"**: registrar timestamp de cada transición del funnel y exponer métricas de velocidad mediana de resolución y primera respuesta | Property Meld Insights — la métrica estrella del líder | Métricas (§11 PRD): definir KPIs concretos |
| 2 | **Score/historial del técnico**: rating post-obra + comparación presupuesto vs factura final por técnico | Vendor scorecard de Property Meld; el original ya tenía calificación 1★-5★ | ABM técnicos + métricas |
| 3 | **Fotos obligatorias en el reporte y en los avances**: el reporte con imagen reduce idas y vueltas (~20% menos reportes mal clasificados en Fixflo) | Fixflo picture-based reporting | Etapa Ingresado + vista técnico |
| 4 | **Plantilla de auto-descarte/triage en el inbox**: opción "no corresponde/resuelto por teléfono" con motivo, antes de crear gestión (Latchel resuelve 23% sin técnico) | Latchel, Mezo | Inbox: acción "descartar con motivo" auditable |
| 5 | **Emails salientes automáticos de estado** al inquilino (recibido / técnico asignado / resuelto), no solo la factura — es el estándar de mercado y baja los re-reclamos | Patrón universal (AppFolio, Latchel, Fixflo) | Notificaciones (§8 PRD): sumar emails de estado |
| 6 | **Urgencia como campo de primera clase** (normal/urgente/emergencia) asignada por la IA y editable — todos los líderes triagean por urgencia, el PRD hoy solo clasifica por especialidad | AppFolio Smart Maintenance, Mezo | Modelo de datos + botón IA |
| 7 | **Comparación presupuesto vs costo final** visible en la etapa de facturación | Property Meld | Etapa Facturación |
| 8 | **Onboarding mínimo**: la implementación pesada (4-8 semanas) es la queja top contra los líderes; mantener el dominio reducido y el funnel de 8 columnas sin configurabilidad excesiva en v1 | Reviews Property Meld | Anti-requisito: resistir feature creep |

### Riesgos y mitigación

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| El técnico no adopta el sistema y vuelve a WhatsApp | Alta (barrera #1 del mercado) | Mobile-first real, mínimos taps por acción, testear con técnicos reales antes del rollout |
| El gestor sigue gestionando por fuera del inbox | Media | El inbox debe ser más rápido que el Gmail nativo: botón IA de 1 click, atajos de descarte |
| La IA clasifica mal y genera desconfianza | Media | Card IA siempre editable + urgencia/especialidad como sugerencia visible, no decisión silenciosa |
| Feature creep hacia una suite (contratos, expensas) | Media | El PRD ya lo excluye; las suites locales cubren eso — integrarse, no competir |

### Métricas de éxito sugeridas (benchmark de mercado)

- Primera respuesta al reporte: < 1 hora en horario laboral (los líderes prometen minutos con call centers 24/7 — para una inmobiliaria, 1h es excelente).
- Velocidad mediana de resolución por especialidad (baseline a establecer el primer trimestre).
- % de gestiones creadas vía botón IA sin edición posterior (calidad del triage).
- 0 reclamos perdidos: todo mail del inbox termina en gestión o descarte con motivo.

### Conclusión

El mercado global ya probó el modelo que MANTIS 2 propone; el mercado argentino no lo tiene. Los diferenciales reales del sistema son cuatro y hay que protegerlos durante todo el desarrollo: **(1) mobile técnico impecable, (2) facturación/liquidación dentro del funnel, (3) legajo + Resumen de obras por período de inquilino, (4) inbox Gmail + IA**. Todo lo demás es soporte de esos cuatro.

---

**Market Research Completion Date:** 2026-07-05
**Source Verification:** todas las afirmaciones citadas con fuentes 2025-2026; niveles de confianza explícitos por sección
**Confidence Level:** Alto en mercado global (reviews e informes verificados); medio en mercado argentino (features públicos, sin estudios formales)
