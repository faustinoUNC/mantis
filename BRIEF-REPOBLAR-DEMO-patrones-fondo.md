# Brief para la IA que repobla la base — casos que lucen "Patrones de fondo" (STORY-1051)

> **Archivo descartable.** Instrucciones para pasarle a la IA que va a **borrar la base y
> recrear casos limpios**, pensados para que la funcionalidad "Patrones de fondo" (y el
> análisis de Walter) se luzca en la presentación. Borrar cuando ya no se use.

---

## 1. Qué es la funcionalidad

MANTIS detecta cuándo **una misma propiedad tiene un rubro (especialidad) que se repite** —
señal de que quizá hay un **problema de fondo** y conviene una obra que ataque la causa, en
vez de re-arreglar el mismo síntoma una y otra vez.

- En **Informes** aparece una bandeja **"Para revisar de fondo"**: lista de propiedades con
  un rubro repetido, **ordenada peor-arriba** (más obras + más apretadas en el tiempo, arriba).
- Dos filtros en vivo: **"desde ≥N obras"** (arranca en 3) y **"últimos X años"** (arranca en "todo").
- Al desplegar una fila se ven las obras de ese rubro, cada una con link a su detalle. Dos
  acciones: **"Iniciar gestión de fondo"** (crea una obra que ataca la causa, pre-cargada, y
  saca la propiedad de la bandeja) y **"No están relacionadas"** (descarta).
- Si más adelante entra una obra nueva de ese rubro, la propiedad **reaparece** con un aviso;
  y si ya se había hecho una obra de fondo, reaparecer significa *"el arreglo no aguantó"*.

## 2. Cómo evalúa Walter (esto define DÓNDE va la señal — MUY importante)

Cuando el usuario pide "analizar con Walter", Walter **lee las NOTAS DE INSPECCIÓN del técnico**
de esas obras (no el reporte del inquilino) y decide si es el mismo problema de fondo. Diferencia
clave:

- **El reporte del inquilino = el SÍNTOMA** → va en la **descripción de la gestión**
  (`gestiones.descripcion`). Ej.: *"no anda la luz del pasillo"*.
- **La nota de inspección del técnico = el DIAGNÓSTICO** → va en el **avance de inspección**
  (`avances`, `tipo = 'inspeccion'`, campo `nota`). Ej.: *"el tablero está sulfatado otra vez"*.
  **ESTO es lo que Walter lee y cita.**

Walter da uno de tres veredictos, y **cita la frase textual** de cada nota que lo sostiene:

- **"De fondo"** → las notas nombran el **mismo componente/causa** una y otra vez (ej. "el mismo
  picaporte", "el mismo tablero"). Cita las notas y sugiere el cambio de fondo.
- **"Coincidencia"** → mismo rubro pero **causas distintas** (termotanque, portón, aire = todos
  "electricidad" pero cosas distintas). Walter dice que NO es de fondo.
- **"Insuficiente"** → las notas son genéricas y no dejan ver la causa → Walter se abstiene y pide
  que el humano mire. **Walter nunca inventa: si no puede citar, no afirma.**

**Conclusión para quien arma los casos:** la historia se cuenta en las **notas de inspección**.
Para un caso "de fondo" convincente, que las 3-4 notas **nombren el mismo componente en palabras
claras**. Para un "coincidencia", que nombren cosas distintas. Para "insuficiente", notas vagas.

## 3. Qué casos crear (para que la feature se luzca)

**Reglas para TODOS:** obras **no canceladas** y en su mayoría **terminadas/finalizadas** (son
historia real); todas con **misma propiedad + misma especialidad**; fechas **repartidas en el
tiempo**; cada obra con su **nota de inspección** escrita con voz de técnico real.

### CASO ESTRELLA — "De fondo" cantado (el que Walter clava)

- **Propiedad A · Cerrajería · 4 obras** en ~10 meses.
- Reportes (síntoma, en la descripción): *"la puerta no cierra bien"*, *"se traba la cerradura"*,
  *"no puedo abrir desde afuera"*, *"otra vez la puerta trabada"*.
- **Notas de inspección (TODAS nombran el picaporte):**
  - *"El picaporte está flojo, se reajustaron los tornillos."*
  - *"El picaporte volvió a aflojarse; el mecanismo interno está gastado."*
  - *"Se lubricó el picaporte, perdió tensión el resorte."*
  - *"El picaporte ya no engancha, es la cuarta vez que se reajusta lo mismo."*
- → Walter: **"de fondo"**, cita las 4, sugiere **cambiar el picaporte** en vez de seguir
  reajustándolo. (Podés hacer un segundo idéntico con **tablero eléctrico** — "se cambió el mismo
  tablero" — que es el caso real de Belgrano 1288 PH 3.)

### CASO "Coincidencia" (demuestra que Walter sabe decir NO)

- **Propiedad B · Electricidad · 3-4 obras.**
- **Notas de inspección con causas DISTINTAS:** *"se quemó la resistencia del termotanque
  eléctrico"*, *"falló el motor del portón automático"*, *"cortocircuito en el aire acondicionado
  del living"*.
- → Walter: **"coincidencia"** — son artefactos distintos, no el tendido. (Sin este caso Walter
  parecería un sello de goma; con él, se ve que discrimina.)

### CASO "Insuficiente" (la abstención honesta)

- **Propiedad C · Plomería · 3 obras.**
- **Notas vagas:** *"se solucionó la pérdida"*, *"arreglado"*, *"listo, ya no gotea"*.
- → Walter: **"insuficiente"** — no puede citar la causa, pide que el humano mire las fotos.
  Muestra que no inventa.

### CASO "El arreglo no aguantó" (el feedback loop — opcional/avanzado)

- **Propiedad D · Humedad (o Pintura) · 3 obras** de re-pintado por humedad, con notas que nombran
  humedad en la misma pared.
- Luego **una gestión de fondo ya hecha** (ej. "impermeabilización de la pared") marcada como
  iniciada-de-fondo, **terminada**.
- Luego **una obra nueva** de humedad, posterior.
- → la propiedad **reaparece** con el aviso *"el arreglo de fondo no aguantó"*. (Necesita registrar
  la "revisión de fondo" ligada a la obra de fondo — tabla `revisiones_fondo`; si es engorroso,
  dejarlo para hacerlo **en vivo** en la demo: iniciar la fondo y después meter una obra nueva.)

### CASOS DE RELLENO (para que la bandeja tenga volumen y se vea el orden)

- **5-6 propiedades más** con 3-5 obras de rubros variados (Gas, Albañilería, Plomería), para que
  la lista tenga varias filas y el **orden peor-arriba** se note.
- **Un caso "envejecimiento normal"**: una propiedad con 3 obras del mismo rubro pero **repartidas
  en 6-8 años**. Debe caer **al fondo** del orden, y al poner el filtro **"últimos 2 años"** debe
  **desaparecer** — demuestra que el sistema no confunde una casa vieja normal con un problema
  crónico.

## 4. Resumen de "qué va en dónde"

- **Síntoma del inquilino** → `gestiones.descripcion`.
- **Diagnóstico del técnico (lo que Walter lee y cita)** → nota de inspección (`avances`,
  `tipo='inspeccion'`, `nota`).
- Para "de fondo": mismo componente nombrado en todas las notas. Para "coincidencia": causas
  distintas. Para "insuficiente": notas vagas.
- Todo **no cancelado**, mayormente **terminado**, misma **propiedad+especialidad**, fechas
  **repartidas**.

---

**Detalle técnico útil para la IA que ejecuta:** la bandeja se computa sobre `metricas.filas`
(una fila por gestión, RLS-scopeada). Cuenta obras **no canceladas** por (propiedad, especialidad).
El "estado" de una obra se deriva de la etapa: cuenta como historia real cuando llega a
`facturacion_cobro` / `liquidacion_tecnico` / `finalizado`. Las notas que lee Walter son los
`avances` con `tipo='inspeccion'`. La spec completa está en `specs/STORY-1051.md`.
