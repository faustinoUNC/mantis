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
  fecha: { fontSize: 9, color: "#71717a" },
  desc: { lineHeight: 1.5 },
  meta: { fontSize: 9, color: "#52525b", marginTop: 5 },
  pie: { position: "absolute", bottom: 40, left: 48, right: 48, fontSize: 8, color: "#a1a1aa", borderTopWidth: 1, borderTopColor: "#e4e4e7", paddingTop: 8 },
});

export interface DatosResumen {
  direccion: string;
  propietario: string;
  inquilino: string;
  periodo: string;
  fecha: string;
  obras: {
    fecha: string;
    especialidad: string;
    descripcion: string;
    tecnico: string | null;
    costo: number | null;
    pagador: string | null;
    finalizada: boolean;
  }[];
}

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
                  {!o.finalizada && "  ·  EN CURSO"}
                </Text>
                <Text style={s.fecha}>{o.fecha}</Text>
              </View>
              <Text style={s.desc}>{o.descripcion}</Text>
              <Text style={s.meta}>
                {o.tecnico ? `Técnico: ${o.tecnico}` : "Sin técnico asignado"}
                {o.costo != null &&
                  `  ·  Costo: $ ${o.costo.toLocaleString("es-AR")}`}
                {o.pagador && `  ·  Pagó: ${o.pagador}`}
              </Text>
            </View>
          ))}
        </View>

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
