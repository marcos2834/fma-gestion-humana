// Catálogo de los 12 perfiles laborales.
// Mismo que perfil.html — mantener sincronizado.

export const PROFILES = {
  estratega:    { name: "El Estratega",     emoji: "🧠", lema: "El que piensa diez pasos adelante" },
  ejecutor:     { name: "El Ejecutor",      emoji: "⚡", lema: "Resultados primero, conversaciones después" },
  liderNatural: { name: "El Líder Natural", emoji: "👑", lema: "Donde hay vacío de mando, sale a tomarlo" },
  innovador:    { name: "El Innovador",     emoji: "💡", lema: "Las reglas son sugerencias" },
  conector:     { name: "El Conector",      emoji: "🤝", lema: "Conoce a quien sea, en cualquier lugar" },
  diplomatico:  { name: "El Diplomático",   emoji: "🕊️", lema: "Encuentra puente donde otros ven muro" },
  inspirador:   { name: "El Inspirador",    emoji: "✨", lema: "Contagia ganas hasta al más escéptico" },
  guardian:     { name: "El Guardián",      emoji: "🛡️", lema: "Lo que hace, lo hace bien" },
  mentor:       { name: "El Mentor",        emoji: "🧭", lema: "Su éxito se mide por el de su equipo" },
  investigador: { name: "El Investigador",  emoji: "🔍", lema: "No se queda con la primera respuesta" },
  catalizador:  { name: "El Catalizador",   emoji: "🔥", lema: "Hace que las cosas pasen, rápido" },
  constructor:  { name: "El Constructor",   emoji: "🏗️", lema: "Ladrillo por ladrillo, sin atajos" }
};

export const PRICE_ARS = 4990;

export function escapeHTML(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
