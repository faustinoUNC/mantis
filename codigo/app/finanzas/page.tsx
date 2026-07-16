import { Finanzas } from "@/components/finanzas/finanzas.client";
import {
  listarCobros,
  listarLiquidaciones,
} from "@/features/finanzas/consultas";

export default async function FinanzasPage() {
  const [cobros, liquidaciones] = await Promise.all([
    listarCobros(),
    listarLiquidaciones(),
  ]);
  return <Finanzas cobros={cobros} liquidaciones={liquidaciones} />;
}
