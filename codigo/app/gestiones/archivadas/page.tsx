import { Archivadas } from "@/components/gestiones/archivadas.client";
import { exigirAlguno } from "@/features/auth/guard";
import { gestionesArchivadas } from "@/features/gestiones/service";

// Archivo de gestiones finalizadas (STORY-935). Solo staff — el layout de
// /gestiones deja pasar al técnico (necesita el detalle), acá se lo rebota.
export default async function ArchivadasPage() {
  await exigirAlguno([
    "administrador",
    "gestor_mantenimiento",
    "gestor_administrativo",
  ]);
  const gestiones = await gestionesArchivadas();
  return <Archivadas gestiones={gestiones} />;
}
