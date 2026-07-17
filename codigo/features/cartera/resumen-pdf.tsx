import {
  Document,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

// PDF "Resumen de obras" por legajo (PRD §3/§8): respaldo documental para
// propietario, inquilino y verificación al recibir llaves. Complementa el
// acta de entrega/devolución estándar del sector (domain research).

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 10, color: "#18181b", fontFamily: "Helvetica" },
  marca: { fontSize: 16, fontFamily: "Helvetica-Bold", letterSpacing: -0.5 },
  guion: { color: "#059669" },
  tipoDoc: { fontSize: 10, color: "#71717a", marginTop: 2, textTransform: "uppercase", letterSpacing: 1 },
  head: { flexDirection: "row", justifyContent: "space-between" },
  seccion: { marginTop: 20 },
  label: { fontSize: 8, color: "#71717a", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  obra: { borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 6, padding: 12, marginTop: 8 },
  obraHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  esp: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#065f46" },
  estTerminada: { color: "#059669" },
  estEnCurso: { color: "#b45309" },
  estCancelada: { color: "#dc2626" },
  fecha: { fontSize: 9, color: "#71717a" },
  desc: { lineHeight: 1.5 },
  problema: { fontSize: 9, color: "#71717a", marginTop: 3, lineHeight: 1.4 },
  meta: { fontSize: 9, color: "#52525b", marginTop: 5 },
  totales: {
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalLabel: { fontSize: 8, color: "#71717a", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  totalMonto: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  pie: { position: "absolute", bottom: 40, left: 48, right: 48, fontSize: 8, color: "#a1a1aa", borderTopWidth: 1, borderTopColor: "#e4e4e7", paddingTop: 8 },
});

export interface DatosResumen {
  direccion: string;
  propietario: string;
  inquilino: string;
  periodo: string;
  fecha: string;
  obras: {
    // STORY-985: estado honesto para el lector — la obra está terminada con la
    // conformidad aprobada; el circuito de cobro/liquidación es asunto interno.
    estado: "terminada" | "en_curso" | "cancelada";
    fecha: string; // terminación real (o reporte si sigue en curso)
    reportada: string;
    especialidad: string;
    trabajo: string | null; // qué se hizo (presupuesto aprobado)
    problema: string; // qué se reportó
    tecnico: string | null;
    costo: number | null;
    pagador: string | null;
  }[];
}

const ESTADO_PDF = {
  terminada: { label: "TERMINADA", estilo: s.estTerminada },
  en_curso: { label: "EN CURSO", estilo: s.estEnCurso },
  cancelada: { label: "CANCELADA", estilo: s.estCancelada },
} as const;

const pesos = (n: number) => `$ ${n.toLocaleString("es-AR")}`;

function ResumenDoc({ datos }: { datos: DatosResumen }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View>
            <Text style={s.marca}>
              MAN<Text style={s.guion}>—</Text>TIS
            </Text>
            <Text style={s.tipoDoc}>Resumen de obras</Text>
          </View>
          <Text style={{ fontSize: 10, color: "#71717a" }}>{datos.fecha}</Text>
        </View>

        <View style={[s.seccion, { flexDirection: "row", gap: 24 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Propiedad</Text>
            <Text>{datos.direccion}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Propietario</Text>
            <Text>{datos.propietario}</Text>
          </View>
        </View>
        <View style={[s.seccion, { flexDirection: "row", gap: 24 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Inquilino del período</Text>
            <Text>{datos.inquilino}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Período de ocupación</Text>
            <Text>{datos.periodo}</Text>
          </View>
        </View>

        <View style={s.seccion}>
          <Text style={s.label}>
            Obras del período ({datos.obras.length})
          </Text>
          {datos.obras.length === 0 && (
            <Text style={{ marginTop: 6, color: "#71717a" }}>
              Sin gestiones de mantenimiento registradas en este período.
            </Text>
          )}
          {datos.obras.map((o, i) => (
            <View key={i} style={s.obra} wrap={false}>
              <View style={s.obraHead}>
                <Text style={s.esp}>
                  {o.especialidad.toUpperCase()}
                  <Text style={ESTADO_PDF[o.estado].estilo}>
                    {"  ·  "}
                    {ESTADO_PDF[o.estado].label}
                  </Text>
                </Text>
                <Text style={s.fecha}>
                  {o.estado === "terminada" ? `Terminada el ${o.fecha}` : o.fecha}
                </Text>
              </View>
              <Text style={s.desc}>{o.trabajo ?? o.problema}</Text>
              {o.trabajo && (
                <Text style={s.problema}>Problema reportado: {o.problema}</Text>
              )}
              <Text style={s.meta}>
                {`Reportado el ${o.reportada}`}
                {`  ·  ${o.tecnico ? `Técnico: ${o.tecnico}` : "Sin técnico asignado"}`}
                {o.costo != null && `  ·  Costo: ${pesos(o.costo)}`}
                {o.pagador && `  ·  Pagó: ${o.pagador}`}
              </Text>
            </View>
          ))}
        </View>

        {datos.obras.some((o) => o.costo != null) && (
          <View style={s.totales}>
            {(
              [
                ["Total del período", () => true],
                ["Pagó inquilino", (o: DatosResumen["obras"][number]) => o.pagador === "inquilino"],
                ["Pagó propietario", (o: DatosResumen["obras"][number]) => o.pagador === "propietario"],
              ] as const
            ).map(([label, filtro]) => (
              <View key={label}>
                <Text style={s.totalLabel}>{label}</Text>
                <Text style={s.totalMonto}>
                  {pesos(
                    datos.obras
                      .filter((o) => o.costo != null && filtro(o))
                      .reduce((sum, o) => sum + (o.costo ?? 0), 0)
                  )}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.pie} fixed>
          Documento de respaldo emitido por la administración vía MANTIS —
          útil para la verificación del estado de la propiedad al momento de
          la devolución de llaves.
        </Text>
      </Page>
    </Document>
  );
}

export async function generarResumenPDF(datos: DatosResumen): Promise<string> {
  const buffer = await renderToBuffer(<ResumenDoc datos={datos} />);
  return buffer.toString("base64");
}
