// Genera el contenido personalizado del informe usando Claude Haiku 4.5.
// Estrategia: 2 llamadas EN PARALELO. Cada una genera la mitad del JSON,
// los resultados se combinan. Esto evita el problema de truncamiento por
// max_tokens y reduce el tiempo total.
//
// CLAVE DE ROBUSTEZ: nunca confiamos en que Haiku devuelva JSON perfecto.
// Si el JSON viene truncado (corte por max_tokens) o con un caracter de más,
// `JSON.parse` tiraba excepción y SE PERDÍA TODA la mitad → informe vacío.
// Ahora usamos un parser tolerante (`parseLoose`) que repara/cierra el JSON
// y rescata todos los campos posibles. Además mergeamos campo por campo, así
// el fallback total solo aparece si NO se recuperó absolutamente nada.
import Anthropic from '@anthropic-ai/sdk';
import { put } from '@vercel/blob';
import { PROFILES } from './profiles.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Headroom amplio: Haiku es rápido, las 2 llamadas corren en paralelo y entran
// holgadas en los 60s de Vercel. Más tokens = menos truncamiento.
const MAX_TOKENS = 4096;

async function logRaw(label, content) {
  try {
    await put(`debug/ai-raw-${Date.now()}-${label}.txt`, content, {
      access: 'public', contentType: 'text/plain', addRandomSuffix: false
    });
  } catch (e) { /* no-op */ }
}

// Aísla el bloque JSON: saca fences markdown y recorta al primer "{".
function extractJSON(raw) {
  let s = (raw || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const firstBrace = s.indexOf('{');
  if (firstBrace > 0) s = s.substring(firstBrace);
  return s;
}

// Repara JSON truncado o ligeramente malformado.
// Recorre el texto siguiendo el estado de strings y la pila de llaves/corchetes.
// Al final: cierra cualquier string abierta, descarta una key colgante sin valor,
// elimina comas finales y cierra todas las estructuras abiertas.
function repairJSON(s) {
  let out = '';
  const stack = [];      // guarda los cierres pendientes: '}' o ']'
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      out += c;
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (c === '{') { stack.push('}'); out += c; continue; }
    if (c === '[') { stack.push(']'); out += c; continue; }
    if (c === '}' || c === ']') { if (stack.length) stack.pop(); out += c; continue; }
    out += c;
  }

  // String cortada a la mitad → la cerramos para no romper el parse.
  if (inString) out += '"';

  // Limpiezas de cola que rompen JSON.parse:
  out = out.replace(/,\s*$/, '');                       // coma colgante
  out = out.replace(/(?:,\s*)?"[^"]*"\s*:\s*$/, '');    // "key": sin valor
  out = out.replace(/(?:,\s*)"[^"]*"\s*$/, '');         // "key" suelta sin :
  out = out.replace(/,\s*$/, '');                       // coma colgante de nuevo
  out = out.replace(/,(\s*[}\]])/g, '$1');              // coma antes de } o ]

  // Cerramos todo lo que quedó abierto.
  while (stack.length) out += stack.pop();
  return out;
}

// Parser tolerante: intenta parse directo; si falla, repara y reintenta.
// Devuelve { obj, ok } — obj es {} si no se pudo rescatar nada.
function parseLoose(raw) {
  const base = extractJSON(raw);
  try {
    return { obj: JSON.parse(base), ok: true };
  } catch (_) { /* seguimos al repair */ }
  try {
    const repaired = repairJSON(base);
    const obj = JSON.parse(repaired);
    return { obj, ok: true, repaired: true };
  } catch (err) {
    return { obj: {}, ok: false, error: err.message };
  }
}

const COMMON_STYLE_GUIDE = (meta, profile, scores) => `Sos consultor SENIOR de RRHH escribiendo un informe psicométrico premium para ${meta.name}.

DATOS:
- Nombre: ${meta.name}
- Perfil: ${profile.name} ${profile.emoji} ("${profile.lema}")
- Scores 0-100: Foco ${scores.foco} (0=Tareas, 100=Personas) · Ritmo ${scores.ritmo} (0=Rápido, 100=Reflexivo) · Estructura ${scores.estructura} (0=Estructurado, 100=Flexible) · Comunicación ${scores.comunicacion} (0=Directa, 100=Diplomática)
- Estilo decisión: ${meta.reaction_value}

ESTILO: Español argentino ("vos", "tenés", "podés"). Tono consultor experimentado: cercano con autoridad. Frases cortas con punch.

EVITÁ: "Sos único", "Tu fortaleza es la empatía", "Te recomendamos trabajar en...", corporate-speak, psico-fluff, anglicismos (NADA de "threshold", "listening", "turnaround"; usá español).

NUNCA uses placeholders tipo "X años", "[dato]", "N", "___" o similares. Si no tenés el dato exacto, redactá la frase sin él. El texto tiene que leerse terminado y listo para un cliente que pagó.

CUIDÁ ortografía y conjugaciones: el informe va a un cliente real, no debe tener typos.

PERSONALIZÁ: mencioná scores reales (${scores.foco}, ${scores.ritmo}, ${scores.estructura}, ${scores.comunicacion}) al menos 2 veces.

EJEMPLO BUENA REDACCIÓN:
"Tu foco está en las personas (${scores.foco}%). Cuando decidís, lo primero que pesás es cómo afecta a quienes están alrededor. Fortaleza enorme en liderazgo. Cuello de botella en roles analíticos puros."

CRÍTICO: respondé SOLO con JSON válido y COMPLETO. Empezá con { y terminá con }. Sin markdown, sin texto extra. Mantené cada texto conciso para que el JSON cierre entero. Escapá las " internas con \\".`;

async function callPart1(meta, profile, scores) {
  const prompt = `${COMMON_STYLE_GUIDE(meta, profile, scores)}

Generá la PRIMERA MITAD del informe. Estructura exacta del JSON (cada párrafo 2-3 oraciones, items 1-2 oraciones):

{
  "intro_paragrafo_1": "Bienvenida personal, mencioná perfil + score fuerte",
  "intro_paragrafo_2": "Implicancias de su combinación de 4 scores",
  "intro_paragrafo_3": "Qué significa ser ${meta.reaction_value} con este perfil",
  "intro_paragrafo_4": "Tipo de organizaciones que valoran este perfil",

  "fortalezas": [
    {"titulo": "Título evocativo", "descripcion": "Específico a sus scores", "donde_se_nota": "Ejemplo concreto"},
    {"titulo": "...", "descripcion": "...", "donde_se_nota": "..."},
    {"titulo": "...", "descripcion": "...", "donde_se_nota": "..."}
  ],

  "desarrollo": [
    {"titulo": "Área a desarrollar", "descripcion": "Por qué se da", "accion_concreta": "Acción esta semana"},
    {"titulo": "...", "descripcion": "...", "accion_concreta": "..."},
    {"titulo": "...", "descripcion": "...", "accion_concreta": "..."}
  ],

  "comunicacion_bullets": ["Bullet 1 con <strong>clave</strong>", "Bullet 2", "Bullet 3", "Bullet 4"],
  "comunicacion_malinterpretaciones": "Cómo lo perciben mal otros",
  "comunicacion_recomendaciones": "Técnicas específicas no genéricas",

  "decisiones_intro": "Cómo decide anclado en scores",
  "decisiones_rinde_mejor": ["Tipo 1 <strong>clave</strong>", "Tipo 2", "Tipo 3"],
  "decisiones_se_traba": ["Tipo 1 <strong>clave</strong>", "Tipo 2", "Tipo 3"],
  "decisiones_regla": "Regla práctica corta y memorable"
}

EMPEZÁ AHORA CON {`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }]
  });
  return response;
}

async function callPart2(meta, profile, scores) {
  const prompt = `${COMMON_STYLE_GUIDE(meta, profile, scores)}

Generá la SEGUNDA MITAD del informe. Estructura exacta del JSON (cada párrafo 2-3 oraciones, items 1-2 oraciones):

{
  "ambientes_potencia": ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"],
  "ambientes_desgasta": ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"],
  "ambientes_jefe_ideal": "Jefe ideal con <strong>rasgos</strong>",
  "ambientes_cultura": "Cultura organizacional ideal",
  "ambientes_entrevista_tips": "3 preguntas específicas para el entrevistador",

  "liderazgo_intro": "Cómo lidera anclado en scores",
  "liderazgo_como_dirige": "Forma de dirigir",
  "liderazgo_como_forma": "Cómo desarrolla a su gente",
  "liderazgo_lo_cuesta": "Qué le cuesta",
  "liderazgo_recordatorio": "Recordatorio práctico (NO empieces con 'Un recordatorio' ni repitas la palabra recordatorio; entrá directo al consejo)",
  "liderazgo_impacto_12_meses": "Qué pasa en su equipo en un año",

  "entrevista_diferencial": "Diferencial real con <strong>frases clave</strong>",
  "entrevista_frases": ["Frase 1 con punch", "Frase 2", "Frase 3", "Frase 4"],
  "entrevista_qa": [
    {"pregunta": "¿Cuál es tu mayor debilidad?", "respuesta": "Respuesta modelo 2-3 oraciones", "por_que_funciona": "1 oración"},
    {"pregunta": "¿Cómo manejás conflictos?", "respuesta": "...", "por_que_funciona": "..."},
    {"pregunta": "Describí un error que cometiste.", "respuesta": "...", "por_que_funciona": "..."},
    {"pregunta": "¿Por qué dejaste tu último trabajo?", "respuesta": "...", "por_que_funciona": "..."}
  ],
  "entrevista_errores_comunes": ["Error 1 <strong>clave</strong>", "Error 2", "Error 3", "Error 4"],
  "entrevista_pitch_60_segundos": "Pitch SIEMPRE en PRIMERA PERSONA (yo delego, yo muevo, yo busco — nunca tercera persona ni el nombre). Natural, específico, sin placeholders como 'X años'",

  "cierre_paragrafo_1": "Cierre personal por nombre",
  "cierre_paragrafo_2": "Mensaje final sobre encontrar contexto donde brilla"
}

EMPEZÁ AHORA CON {`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }]
  });
  return response;
}

function textOf(response) {
  const block = (response?.content || []).find(b => b.type === 'text');
  return block ? block.text : '';
}

export async function generateReportContent(meta) {
  const profile = PROFILES[meta.profile_key];
  if (!profile) throw new Error(`Perfil desconocido: ${meta.profile_key}`);

  const scores = {
    foco: meta.foco, ritmo: meta.ritmo,
    estructura: meta.estructura, comunicacion: meta.comunicacion
  };

  // 2 llamadas EN PARALELO. allSettled: si una falla por red, la otra sobrevive.
  const [res1, res2] = await Promise.allSettled([
    callPart1(meta, profile, scores),
    callPart2(meta, profile, scores)
  ]);

  const raw1 = res1.status === 'fulfilled' ? textOf(res1.value) : '';
  const raw2 = res2.status === 'fulfilled' ? textOf(res2.value) : '';
  const stop1 = res1.status === 'fulfilled' ? res1.value.stop_reason : `rejected: ${res1.reason?.message}`;
  const stop2 = res2.status === 'fulfilled' ? res2.value.stop_reason : `rejected: ${res2.reason?.message}`;

  const p1 = parseLoose(raw1);
  const p2 = parseLoose(raw2);

  // Log diagnóstico: stop_reason (¿truncó?), longitud y si hubo que reparar.
  logRaw('part1', `stop=${stop1} len=${raw1.length} ok=${p1.ok} repaired=${!!p1.repaired} err=${p1.error || ''}\n\n${raw1}`).catch(() => {});
  logRaw('part2', `stop=${stop2} len=${raw2.length} ok=${p2.ok} repaired=${!!p2.repaired} err=${p2.error || ''}\n\n${raw2}`).catch(() => {});

  // Merge campo por campo. Cualquier campo rescatado se conserva.
  const merged = { ...p1.obj, ...p2.obj };

  // Fallback total SOLO si no se recuperó absolutamente nada de ninguna parte.
  if (Object.keys(merged).length === 0) {
    return {
      intro_paragrafo_1: `${meta.name}, este es tu informe del perfil ${profile.name}.`,
      intro_paragrafo_2: 'Hubo un problema al personalizar la versión completa. Te enviamos esta base. Respondé este mail y te la regeneramos sin cargo.',
      _fallback: true
    };
  }

  return merged;
}

// Export para tests locales del parser.
export const _internal = { extractJSON, repairJSON, parseLoose };
