// Mapa embebido de Google Maps sin API key (STORY-205, Regla #0).
// El tratamiento visual es el de Card: borde hairline, radio lg.

export function urlGoogleMaps(direccion: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}

export function MapaDireccion({
  direccion,
  alto = 220,
}: {
  direccion: string;
  alto?: number;
}) {
  return (
    <iframe
      title={`Mapa de ${direccion}`}
      src={`https://maps.google.com/maps?q=${encodeURIComponent(direccion)}&z=16&output=embed`}
      height={alto}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      className="w-full rounded-lg border border-border"
    />
  );
}

export function BotonGoogleMaps({ direccion }: { direccion: string }) {
  return (
    <a
      href={urlGoogleMaps(direccion)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 min-h-tap px-4 rounded-md font-medium text-[0.9375rem] bg-surface text-foreground border border-border-strong hover:bg-surface-2 transition-colors"
    >
      {/* Pin en SVG propio */}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      Abrir en Google Maps
    </a>
  );
}
