import { CarteraTabs } from "@/components/cartera/tabs.client";
import { PanelShell } from "@/components/paneles/panel-shell";
import { exigirAlguno } from "@/features/auth/guard";

// Sección compartida: admin y ambos gestores (nunca técnico).
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await exigirAlguno([
    "administrador",
    "gestor_mantenimiento",
    "gestor_administrativo",
  ]);
  return (
    <PanelShell usuario={usuario}>
      <CarteraTabs />
      {children}
    </PanelShell>
  );
}
