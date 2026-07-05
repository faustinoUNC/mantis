import { Empleados } from "@/components/empleados/empleados.client";
import { listarEmpleados } from "@/features/empleados/service";

export default async function EmpleadosPage() {
  const empleados = await listarEmpleados();
  return <Empleados empleados={empleados} />;
}
