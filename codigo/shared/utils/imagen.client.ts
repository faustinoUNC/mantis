// STORY-945: las fotos de cámara (2–8 MB) exceden el límite de body de los
// server actions (y el techo de ~4.5 MB de Vercel), así que las imágenes se
// comprimen en el navegador antes de viajar. PDFs y archivos chicos pasan
// intactos; si algo falla, se manda el original (fail-open).

const UMBRAL_BYTES = 600 * 1024;
const LADO_MAX = 1600;
const CALIDAD_JPEG = 0.8;

export async function comprimirImagen(archivo: File): Promise<File> {
  if (!archivo.type.startsWith("image/") || archivo.size <= UMBRAL_BYTES) {
    return archivo;
  }
  try {
    const bitmap = await createImageBitmap(archivo, {
      imageOrientation: "from-image",
    });
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * escala));
    canvas.height = Math.max(1, Math.round(bitmap.height * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) return archivo;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", CALIDAD_JPEG)
    );
    if (!blob || blob.size >= archivo.size) return archivo;
    return new File([blob], archivo.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return archivo;
  }
}

// Reemplaza los archivos de un input por sus versiones comprimidas.
export async function comprimirArchivosDeInput(input: HTMLInputElement) {
  const archivos = Array.from(input.files ?? []);
  if (archivos.length === 0) return;
  const comprimidos = await Promise.all(archivos.map(comprimirImagen));
  if (comprimidos.every((archivo, i) => archivo === archivos[i])) return;
  const dt = new DataTransfer();
  for (const archivo of comprimidos) dt.items.add(archivo);
  input.files = dt.files;
}
