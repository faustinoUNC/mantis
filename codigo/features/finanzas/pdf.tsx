import {
  Document,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

// PDFs de finanzas (nota de cobro y comprobante de liquidación) — generados
// on-demand, estética del design contract (esmeralda técnica).

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 11, color: "#18181b", fontFamily: "Helvetica" },
  marca: { fontSize: 16, fontFamily: "Helvetica-Bold", letterSpacing: -0.5 },
  guion: { color: "#059669" },
  tipoDoc: { fontSize: 10, color: "#71717a", marginTop: 2, textTransform: "uppercase", letterSpacing: 1 },
  fila: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  seccion: { marginTop: 24 },
  label: { fontSize: 9, color: "#71717a", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  valor: { fontSize: 11 },
  caja: { borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 6, padding: 14, marginTop: 8 },
  filaTabla: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#e4e4e7" },
  total: { flexDirection: "row", justifyContent: "space-between", paddingTop: 10 },
  totalTexto: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  pie: { position: "absolute", bottom: 40, left: 48, right: 48, fontSize: 8, color: "#a1a1aa", borderTopWidth: 1, borderTopColor: "#e4e4e7", paddingTop: 8 },
});

export interface DatosDocumento {
  tipo: "nota" | "comprobante" | "presupuesto";
  numero: string;
  fecha: string;
  destinatarioNombre: string;
  destinatarioRotulo: string; // "Inquilino" | "Propietario" | "Técnico"
  direccion: string;
  especialidad: string;
  descripcion: string;
  detalleTrabajo: string | null;
  tecnicoNombre: string | null;
  presupuesto: { materiales: number; manoObra: number } | null;
  total: number;
  facturaRef?: string | null;
  medioPago?: string | null;
  plazoDias?: number | null;
  // STORY-934: la línea de materiales trae la rendición real del técnico
  materialesRendidos?: boolean;
}

function monto(n: number) {
  return `$ ${n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const TITULO_DOC: Record<DatosDocumento["tipo"], string> = {
  nota: "Nota de cobro",
  comprobante: "Comprobante de liquidación",
  presupuesto: "Presupuesto de obra",
};

function Documento({ datos }: { datos: DatosDocumento }) {
  const esNota = datos.tipo === "nota";
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.fila}>
          <View>
            <Text style={s.marca}>
              MAN<Text style={s.guion}>—</Text>TIS
            </Text>
            <Text style={s.tipoDoc}>
              {TITULO_DOC[datos.tipo]} · N° {datos.numero}
            </Text>
          </View>
          <Text style={{ fontSize: 10, color: "#71717a" }}>{datos.fecha}</Text>
        </View>

        <View style={s.seccion}>
          <Text style={s.label}>{datos.destinatarioRotulo}</Text>
          <Text style={s.valor}>{datos.destinatarioNombre}</Text>
        </View>

        <View style={s.seccion}>
          <Text style={s.label}>Propiedad</Text>
          <Text style={s.valor}>{datos.direccion}</Text>
        </View>

        {datos.tipo === "comprobante" && (
          <View style={s.caja}>
            <Text style={s.label}>Pago registrado</Text>
            <Text style={s.valor}>
              Se liquidó {monto(datos.total)} el {datos.fecha}.
              {datos.medioPago ? ` Método de pago: ${datos.medioPago}.` : ""}
            </Text>
          </View>
        )}

        <View style={s.caja}>
          <Text style={s.label}>Trabajo realizado ({datos.especialidad})</Text>
          <Text style={{ marginTop: 2, lineHeight: 1.5 }}>{datos.descripcion}</Text>
          {datos.detalleTrabajo && (
            <Text style={{ marginTop: 6, lineHeight: 1.5, color: "#52525b" }}>
              {datos.detalleTrabajo}
            </Text>
          )}
          {datos.tecnicoNombre && (
            <Text style={{ marginTop: 6, fontSize: 9, color: "#71717a" }}>
              Ejecutado por: {datos.tecnicoNombre}
            </Text>
          )}
        </View>

        {/* STORY-942: el desglose solo lo ve el TÉCNICO en su comprobante.
            Presupuesto y nota van al pagador con UN solo número (el total,
            fee incluido) — la comisión no se expone. */}
        <View style={s.caja}>
          {datos.tipo === "comprobante" && datos.presupuesto && (
            <>
              <View style={s.filaTabla}>
                <Text>
                  Materiales
                  {datos.materialesRendidos
                    ? " (rendidos por el técnico)"
                    : " (presupuesto aprobado)"}
                </Text>
                <Text>{monto(datos.presupuesto.materiales)}</Text>
              </View>
              <View style={s.filaTabla}>
                <Text>Mano de obra (presupuesto aprobado)</Text>
                <Text>{monto(datos.presupuesto.manoObra)}</Text>
              </View>
            </>
          )}
          <View style={s.total}>
            <Text style={s.totalTexto}>
              {datos.tipo === "presupuesto"
                ? "Total presupuestado"
                : esNota
                  ? "Total a cobrar"
                  : "Total liquidado al técnico"}
            </Text>
            <Text style={s.totalTexto}>{monto(datos.total)}</Text>
          </View>
        </View>

        {datos.plazoDias != null && (
          <View style={s.seccion}>
            <Text style={s.label}>Plazo estimado de ejecución</Text>
            <Text style={s.valor}>{datos.plazoDias} día{datos.plazoDias === 1 ? "" : "s"}</Text>
          </View>
        )}

        {datos.facturaRef && (
          <View style={s.seccion}>
            <Text style={s.label}>Referencia factura del técnico</Text>
            <Text style={s.valor}>{datos.facturaRef}</Text>
          </View>
        )}

        <Text style={s.pie}>
          {datos.tipo === "presupuesto"
            ? "Presupuesto informativo emitido por la administración vía MANTIS — sujeto a aprobación. No reemplaza comprobantes fiscales."
            : "Documento interno de la inmobiliaria emitido por MANTIS. No reemplaza comprobantes fiscales. Ante consultas, contactá a la administración."}
        </Text>
      </Page>
    </Document>
  );
}

export async function generarPDF(datos: DatosDocumento): Promise<string> {
  const buffer = await renderToBuffer(<Documento datos={datos} />);
  return buffer.toString("base64");
}
