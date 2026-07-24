// STORY-1049: "materiales autorizados" = presupuesto original de materiales +
// ampliaciones APROBADAS de la gestión. Es el denominador de la métrica de
// desvío de presupuesto (STORY-937): una ampliación aprobada y gastada NO debe
// contar como sobrecosto, porque la inmobiliaria autorizó ese gasto extra.
//
// Definición ÚNICA de "cuánta plata de ampliación se autorizó", consumida por
// los tres cómputos del desvío (picker/Walter en `estadisticasTecnicos`, card
// de Informes y desvío por obra del detalle). No repetir la suma a mano en cada
// consumidor — así nació el bug.
//
// Solo `aprobada`: una ampliación `rechazada` o `enviada` (pendiente) NO agranda
// el techo, así que gastar por encima con ella sigue contando como desvío (el
// técnico gastó sin autorización). Es la misma llave que usan el gate de
// conformidad (STORY-1046) y el tope de adelanto (STORY-1018).
//
// El monto suma ENTERO, sin partir en materiales/mano de obra (la ampliación es
// un solo `monto`; la mano de obra es fija por diseño y toda la rendición real
// cae en materiales) — misma decisión, a sabiendas, que el tope de la 1018.
export function sumaAmpliacionesAprobadas(
  ampliaciones: { estado: string; monto: number | string }[] | null | undefined
): number {
  return (ampliaciones ?? [])
    .filter((a) => a.estado === "aprobada")
    .reduce((total, a) => total + Number(a.monto), 0);
}
