import { notFound } from "next/navigation";
import { Dashboard } from "@/components/metricas/dashboard.client";
import { obtenerMetricas } from "@/features/metricas/service";

export default async function MetricasPage() {
  const metricas = await obtenerMetricas();
  if (!metricas) notFound();
  return <Dashboard metricas={metricas} />;
}
