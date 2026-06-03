// Genera el contenido personalizado del informe usando Claude Haiku 4.5.
// Estrategia: 2 llamadas EN PARALELO. Cada una genera la mitad del JSON,
// los resultados se combinan. Esto evita el problema de truncamiento por
// max_tokens y reduce el tiempo total (~25s en vez de 50s).
import Anthropic from '@anthropic-ai/sdk';
import { put } from '@vercel/blob';
import { PROFILES } from './profiles.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function logRaw(label, content) {
  try {
    await put(`debug/ai-raw-${Date.now()}-${label}.txt`, content, {
      access: 'public', contentType: 'text/plain', addRandomSuffix: false
    });
  } catch (e) { /* no-op */ }
}

function extractJSON(raw) {
  let s = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    s = s.substring(firstBrace, lastBrace + 1);
  }
  return s;
}

const COMMON_STYLE_GUIDE = (meta, profile, scores) => `Sos consultor SENIOR de RRHH escribiendo un informe psicométrico premium para ${meta.name}.

DATOS:
- Nombre: ${meta.name}
- Perfil: ${profile.name} ${profile.emoji} ("${profile.lema}")
- Scores 0-100: Foco ${scores.foco} (0=Tareas, 100=Personas) · Ritmo ${scores.ritmo} (0=Rápido, 100=Reflexivo) · Estructura ${scores.estructura} (0=Estructurado, 100=Flexible) · Comunicación ${scores.comunicacion} (0=Directa, 100=Diplomática)
- Estilo decisión: ${meta.reaction_value}

ESTILO: Español argentino ("vos", "tenés", "podés"). Tono consultor experimentado: cercano con autoridad. Frases cortas con punch.

EVITÁ: "Sos único", "Tu fortaleza es la empatía", "Te recomendamos trabajar en...", corporate-speak, psico-fluff.

PERSONALIZÁ: mencioná scores reales (${scores.foco}, ${scores.ritmo}, ${scores.estructura}, ${scores.comunicacion}) al menos 2 veces.

EJEMPLO BUENA REDACCIÓN:
"Tu foco está en las personas (${scores.foco}%). Cuando decidís, lo primero que pesás es cómo afecta a quienes están alrededor. Fortaleza enorme en liderazgo. Cuello de botella en roles analíticos puros."

CRÍTICO: respondé SOLO con JSON válido. Empezá con { y terminá con }. Sin markdown, sin texto extra. Escapá " internas con \\".`;

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
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }]
  });
  return response.content[0].text;
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
  "liderazgo_recordatorio": "Recordatorio práctico",
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
  "entrevista_pitch_60_segundos": "Pitch en primera persona, natural, específico",

  "cierre_paragrafo_1": "Cierre personal por nombre",
  "cierre_paragrafo_2": "Mensaje final sobre encontrar contexto donde brilla"
}

EMPEZÁ AHORA CON {`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }]
  });
  return response.content[0].text;
}

export async function generateReportContent(meta) {
  const profile = PROFILES[meta.profile_key];
  if (!profile) throw new Error(`Perfil desconocido: ${meta.profile_key}`);

  const scores = {
    foco: meta.foco, ritmo: meta.ritmo,
    estructura: meta.estructura, comunicacion: meta.comunicacion
  };

  // 2 llamadas EN PARALELO
  const [raw1, raw2] = await Promise.all([
    callPart1(meta, profile, scores),
    callPart2(meta, profile, scores)
  ]);

  // Log raw responses en background
  logRaw('part1', raw1).catch(() => {});
  logRaw('part2', raw2).catch(() => {});

  let part1 = {}, part2 = {};
  try {
    part1 = JSON.parse(extractJSON(raw1));
  } catch (err) {
    logRaw('part1-parse-failed', JSON.stringify({error: err.message, raw: raw1.slice(0, 2000)})).catch(() => {});
  }
  try {
    part2 = JSON.parse(extractJSON(raw2));
  } catch (err) {
    logRaw('part2-parse-failed', JSON.stringify({error: err.message, raw: raw2.slice(0, 2000)})).catch(() => {});
  }

  const merged = { ...part1, ...part2 };

  // Si AMBAS partes fallaron, devolver fallback
  if (Object.keys(merged).length === 0) {
    return {
      intro_paragrafo_1: `${meta.name}, este es tu informe del perfil ${profile.name}.`,
      intro_paragrafo_2: 'Hubo un problema al personalizar la versión completa. Te enviamos esta base. Respondé este mail y te la regeneramos sin cargo.',
      _fallback: true
    };
  }

  return merged;
}
