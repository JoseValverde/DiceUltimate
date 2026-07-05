// Catálogo de símbolos para caras de dados personalizados
export const SIMBOLOS = {
  exito: { label: "Éxito", icon: "✅" },
  fallo: { label: "Fallo", icon: "❌" },
  critico: { label: "Crítico", icon: "💥" },
  blanco: { label: "En blanco", icon: "▫️" },
  escudo: { label: "Escudo", icon: "🛡️" },
  espada: { label: "Espada", icon: "⚔️" },
} as const;

export type Simbolo = keyof typeof SIMBOLOS;
export type Cara = { value: number } | { symbol: Simbolo };

export function iconoDeCara(cara: Cara): string {
  return "value" in cara ? String(cara.value) : SIMBOLOS[cara.symbol]?.icon ?? "?";
}
