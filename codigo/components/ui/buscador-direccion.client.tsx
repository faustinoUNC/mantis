"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "./input";

// Autocompletado de direcciones con Photon (geocoder de OpenStreetMap,
// gratuito y sin API key — misma línea que el mapa embebido de STORY-205).
// Sesgo a Córdoba y filtro a Argentina. El campo sigue siendo texto libre:
// si el geocoder no encuentra (o no hay red), se puede escribir igual.
const URL_PHOTON = "https://photon.komoot.io/api/";

export interface DireccionElegida {
  etiqueta: string;
  lat: number;
  lon: number;
  // true = OSM tiene la altura exacta (pin por lat/lon). false = la sugerencia
  // es la calle: el mapa debe buscar el texto completo (Google interpola alturas).
  exacta: boolean;
}

type PropsPhoton = {
  countrycode?: string;
  osm_key?: string;
  osm_value?: string;
  name?: string;
  street?: string;
  housenumber?: string;
  city?: string;
  district?: string;
  county?: string;
  state?: string;
};

// Altura tipeada: el último número del texto ("9 de Julio 2450" → 2450).
function alturaDe(texto: string): string | null {
  const numeros = texto.match(/\d{1,5}/g);
  return numeros ? numeros[numeros.length - 1] : null;
}

// Photon rankea por cercanía y puede poner primero calles que no se parecen a
// lo tipeado (STORY-952): para comparar, se normaliza sin tildes, números ni
// prefijos de vía. La ñ pierde la virgulilla (queda "n") en ambos lados, así
// que la comparación sigue siendo consistente.
function normalizarCalle(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(av|avda|avenida|calle|bv|blvd|boulevard|pje|pasaje|ruta)\b\.?/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aSugerencia(
  p: PropsPhoton,
  coordenadas: [number, number],
  alturaTipeada: string | null
): DireccionElegida | null {
  const ciudad = p.city ?? p.district ?? p.county;
  const [lon, lat] = coordenadas;
  if (p.housenumber && p.street) {
    // Dirección exacta en OSM: pin por coordenadas.
    return {
      etiqueta: [`${p.street} ${p.housenumber}`, ciudad, p.state].filter(Boolean).join(", "),
      lat,
      lon,
      exacta: true,
    };
  }
  // Calle sola (sin la altura en OSM): conservar la altura que tipeó el
  // usuario para no perderla al elegir; el mapa buscará el texto completo.
  const esCalle = p.osm_key === "highway" && p.osm_value !== "bus_stop" && p.osm_value !== "platform";
  if (!esCalle || !p.name) return null;
  const calle = alturaTipeada ? `${p.name} ${alturaTipeada}` : p.name;
  return {
    etiqueta: [calle, ciudad, p.state].filter(Boolean).join(", "),
    lat,
    lon,
    exacta: false,
  };
}

export function BuscadorDireccion({
  value,
  onChange,
  onElegir,
  placeholder,
}: {
  value: string;
  onChange: (texto: string) => void;
  onElegir: (d: DireccionElegida) => void;
  placeholder?: string;
}) {
  const [sugerencias, setSugerencias] = useState<DireccionElegida[]>([]);
  const [abierta, setAbierta] = useState(false);
  const elegida = useRef<string | null>(null);

  useEffect(() => {
    const texto = value.trim();
    // No re-sugerir sobre la dirección ya elegida (ni cuando se le agrega
    // piso/depto a mano al final).
    if (texto.length < 4 || (elegida.current && texto.startsWith(elegida.current))) {
      setSugerencias([]);
      setAbierta(false);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `${URL_PHOTON}?q=${encodeURIComponent(texto)}&limit=10&lat=-31.42&lon=-64.18`,
          { signal: ctl.signal }
        );
        type Feature = { properties: PropsPhoton; geometry: { coordinates: [number, number] } };
        const data = (await r.json()) as { features?: Feature[] };
        const altura = alturaDe(texto);
        const lista = (data.features ?? [])
          .filter((f) => f.properties?.countrycode === "AR")
          .map((f) => aSugerencia(f.properties, f.geometry.coordinates, altura))
          .filter(
            (s, i, arr): s is DireccionElegida =>
              s !== null && arr.findIndex((x) => x?.etiqueta === s.etiqueta) === i
          );
        // Las sugerencias cuya calle coincide con lo tipeado van primero; el
        // empate conserva el orden de Photon (cercanía). Sort estable.
        const calle = normalizarCalle(texto.split(",")[0]);
        const coincide = (s: DireccionElegida) =>
          calle !== "" && normalizarCalle(s.etiqueta.split(",")[0]).includes(calle);
        const ordenada = lista
          .sort((a, b) => Number(coincide(b)) - Number(coincide(a)))
          .slice(0, 5);
        setSugerencias(ordenada);
        setAbierta(ordenada.length > 0);
      } catch {
        // Sin red o request abortado: el campo queda como texto libre.
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [value]);

  return (
    <div className="relative">
      <Input
        label="Dirección"
        required
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setAbierta(sugerencias.length > 0)}
        onBlur={() => setTimeout(() => setAbierta(false), 150)}
      />
      {abierta && (
        <ul
          role="listbox"
          aria-label="Direcciones sugeridas"
          className="absolute z-10 left-0 right-0 top-full mt-1 rounded-md border border-border-strong bg-surface overflow-hidden animate-aparecer"
        >
          {sugerencias.map((s) => (
            <li key={`${s.lat},${s.lon}`} className="border-b border-border last:border-0">
              <button
                type="button"
                className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-surface-2 transition-colors"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  elegida.current = s.etiqueta;
                  onChange(s.etiqueta);
                  onElegir(s);
                  setAbierta(false);
                  setSugerencias([]);
                }}
              >
                {s.etiqueta}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
