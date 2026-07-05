// Catálogo global de iconos para caras de dados personalizados.
// Cada cara puede llevar además un nombre libre (label).
export const SIMBOLOS = {
  // Resultados
  exito: { label: "Éxito", icon: "✅" },
  fallo: { label: "Fallo", icon: "❌" },
  critico: { label: "Crítico", icon: "💥" },
  blanco: { label: "En blanco", icon: "▫️" },
  // Combate
  espada: { label: "Espada", icon: "⚔️" },
  escudo: { label: "Escudo", icon: "🛡️" },
  hacha: { label: "Hacha", icon: "🪓" },
  arco: { label: "Arco", icon: "🏹" },
  punal: { label: "Puñal", icon: "🗡️" },
  punio: { label: "Puño", icon: "👊" },
  // Magia y elementos
  fuego: { label: "Fuego", icon: "🔥" },
  hielo: { label: "Hielo", icon: "❄️" },
  rayo: { label: "Rayo", icon: "⚡" },
  agua: { label: "Agua", icon: "💧" },
  tierra: { label: "Tierra", icon: "🪨" },
  viento: { label: "Viento", icon: "🌪️" },
  veneno: { label: "Veneno", icon: "☠️" },
  magia: { label: "Magia", icon: "✨" },
  curacion: { label: "Curación", icon: "💚" },
  pocion: { label: "Poción", icon: "🧪" },
  // Estados y varios
  corazon: { label: "Corazón", icon: "❤️" },
  calavera: { label: "Calavera", icon: "💀" },
  estrella: { label: "Estrella", icon: "⭐" },
  ojo: { label: "Ojo", icon: "👁️" },
  luna: { label: "Luna", icon: "🌙" },
  sol: { label: "Sol", icon: "☀️" },
  moneda: { label: "Moneda", icon: "🪙" },
  gema: { label: "Gema", icon: "💎" },
  llave: { label: "Llave", icon: "🗝️" },
  candado: { label: "Candado", icon: "🔒" },
  bandera: { label: "Bandera", icon: "🚩" },
  diana: { label: "Diana", icon: "🎯" },
  trebol: { label: "Trébol", icon: "🍀" },
  libro: { label: "Libro", icon: "📖" },
  mapa: { label: "Mapa", icon: "🗺️" },
  huella: { label: "Huella", icon: "🐾" },
} as const;

export type Simbolo = keyof typeof SIMBOLOS;
export type Cara =
  | { value: number }
  | { symbol: Simbolo; label?: string };

export function iconoDeCara(cara: Cara): string {
  return "value" in cara ? String(cara.value) : SIMBOLOS[cara.symbol]?.icon ?? "?";
}

// Icono para una clave de conteo agregado (etiqueta libre o símbolo)
export function iconoDeClave(clave: string, results?: { symbol?: string; label?: string }[]): string {
  if (clave in SIMBOLOS) return SIMBOLOS[clave as Simbolo].icon;
  const r = results?.find((x) => x.label === clave);
  return r?.symbol ? SIMBOLOS[r.symbol as Simbolo]?.icon ?? "" : "";
}
