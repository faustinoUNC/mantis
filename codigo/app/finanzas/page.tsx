import { Finanzas } from "@/components/finanzas/finanzas.client";
import {
  listarAdelantos,
  listarCobros,
  listarLiquidaciones,
} from "@/features/finanzas/consultas";

export default async function FinanzasPage() {
  const [cobros, liquidaciones, adelantos] = await Promise.all([
    listarCobros(),
    listarLiquidaciones(),
    listarAdelantos(),
  ]);
  return (
    <Finanzas cobros={cobros} liquidaciones={liquidaciones} adelantos={adelantos} />
  );
}
