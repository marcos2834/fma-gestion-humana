// Genera el contenido personalizado del informe usando Claude Haiku 4.5.
// Incluye parseo robusto + logging del raw response para debugging.
import Anthropic from '@anthropic-ai/sdk';
import { put } from '@vercel/blob';
import { PROFILES } from './profiles.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Helper: guarda el raw response en Blob para debugging
async function logRawResponse(label, content) {
  try {
    const key = `debug/ai-raw-${Date.now()}-${label}.txt`;
    await put(key, content, { access: 'public', contentType: 'text/plain', addRandomSuffix: false });
  } catch (e) { /* no-op */ }
}

// Extracción robusta de JSON desde respuesta que puede tener wrapping/texto extra
function extractJSON(raw) {
  // 1. Limpiar markdown wrapping
  let s = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

  // 2. Si empieza con texto antes del JSON, encontrar el primer { y el último }
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace > 0 || lastBrace < s.length - 1) {
    s = s.substring(firstBrace, lastBrace + 1);
  }

  return s;
}

export async function generateReportContent(meta) {
  const profile = PROFILES[meta.profile_key];
  if (!profile) throw new Error(`Perfil desconocido: ${meta.profile_key}`);

  const scores = {
    foco: meta.foco, ritmo: meta.ritmo,
    estructura: meta.estructura, comunicacion: meta.comunicacion
  };

  const prompt = buildPrompt(meta, profile, scores);

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 6000,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text;

  // Siempre logueamos el raw para debugging
  await logRawResponse('full', raw);

  const cleaned = extractJSON(raw);

  try {
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch (err) {
    // Log detallado del error
    await logRawResponse('parse-failed', JSON.stringify({
      error: err.message,
      rawStart: raw.slice(0, 1000),
      cleanedStart: cleaned.slice(0, 1000),
      cleanedEnd: cleaned.slice(-500),
      length: cleaned.length
    }, null, 2));

    return {
      intro_paragrafo_1: `${meta.name}, este es tu informe del perfil ${profile.name}.`,
      intro_paragrafo_2: 'Hubo un problema al personalizar la versión completa. Te enviamos esta base. Respondé este mail y te la regeneramos sin cargo.',
      _fallback: true,
      _parseError: err.message
    };
  }
}

function buildPrompt(meta, profile, scores) {
  return `Sos un consultor SENIOR de RRHH con 15+ años de experiencia escribiendo informes psicométricos. Estás escribiendo un informe PREMIUM ($5000 ARS) para ${meta.name}.

DATOS DEL USUARIO:
- Nombre: ${meta.name}
- Perfil: ${profile.name} ${profile.emoji}
- Lema: "${profile.lema}"
- Scores (0-100):
  · Foco: ${scores.foco} (0=Tareas, 100=Personas)
  · Ritmo: ${scores.ritmo} (0=Acción rápida, 100=Reflexión)
  · Estructura: ${scores.estructura} (0=Estructurado, 100=Flexible)
  · Comunicación: ${scores.comunicacion} (0=Directa, 100=Diplomática)
- Estilo de decisión: ${meta.reaction_value} (${meta.reaction_avg_seconds}s promedio)

════════════════════════════════════════
ESTÁNDARES DE CALIDAD
════════════════════════════════════════

ESTILO:
- Español argentino: "vos", "tenés", "podés" — NUNCA "tú", "tienes", "puedes"
- Tono: consultor experimentado hablando 1:1 — cercano pero con autoridad
- Frases cortas con punch. Sin subordinadas anidadas
- Cero corporate-speak ("sinergias", "valor agregado")
- Cero psico-fluff ("viaje de autoconocimiento", "abrazá tus fortalezas")

EJEMPLO BUENA REDACCIÓN:
"Tu foco está claramente en las personas (78%). Cuando decidís, lo primero que pesás es cómo va a afectar a quienes están alrededor — y recién después los datos. Es una fortaleza enorme en roles de líder. Es un cuello de botella en roles puramente analíticos."

EVITÁ:
- "Sos una persona única" → vacío
- "Tu fortaleza es la empatía" → cliché
- "Te recomendamos trabajar en..." → autoayuda
- Listas de adjetivos sin contexto

PERSONALIZACIÓN OBLIGATORIA:
- Mencioná scores específicos 3+ veces en todo el informe
- Si Foco > 70: hablá del lado "personas". Si < 30: "tareas". Si 30-70: matizá.
- Mismo para los otros 3 ejes
- Mencioná "${meta.reaction_value}" 1-2 veces

════════════════════════════════════════
FORMATO DE RESPUESTA — CRÍTICO
════════════════════════════════════════

RESPONDÉ ÚNICAMENTE CON UN JSON VÁLIDO. Empezá tu respuesta con { y terminá con }.
NO uses bloques de código markdown (sin \`\`\`json ni \`\`\`).
NO escribas texto antes del { ni después del }.
Escapá las comillas dobles internas con \\".

ESTRUCTURA EXACTA del JSON:

{
  "intro_paragrafo_1": "Párrafo de bienvenida — nombralo, mencioná perfil, conectá con un score específico fuerte (2-3 oraciones)",
  "intro_paragrafo_2": "Profundizá en la combinación de scores (2-3 oraciones)",
  "intro_paragrafo_3": "Estilo de decisión: qué significa ${meta.reaction_value} para este perfil (2-3 oraciones)",
  "intro_paragrafo_4": "Tipo de organizaciones que lo valoran (2-3 oraciones)",

  "fortalezas": [
    {"titulo": "Título corto evocativo no genérico", "descripcion": "2-3 oraciones específicas a los scores", "donde_se_nota": "1 oración con ejemplo concreto"},
    {"titulo": "...", "descripcion": "...", "donde_se_nota": "..."},
    {"titulo": "...", "descripcion": "...", "donde_se_nota": "..."}
  ],

  "desarrollo": [
    {"titulo": "Título — área a desarrollar", "descripcion": "2-3 oraciones de por qué", "accion_concreta": "Acción específica para esta semana"},
    {"titulo": "...", "descripcion": "...", "accion_concreta": "..."},
    {"titulo": "...", "descripcion": "...", "accion_concreta": "..."}
  ],

  "comunicacion_bullets": [
    "4 marcas distintivas con <strong>palabras clave</strong>. 1-2 oraciones cada una.",
    "...", "...", "..."
  ],
  "comunicacion_malinterpretaciones": "Párrafo: cómo lo perciben mal otros y por qué (2-3 oraciones)",
  "comunicacion_recomendaciones": "Párrafo con 1-2 técnicas específicas (no genéricas, 2-3 oraciones)",

  "decisiones_intro": "Cómo decide, anclado en sus scores (2-3 oraciones)",
  "decisiones_rinde_mejor": [
    "Tipo 1 con <strong>palabras clave</strong>",
    "Tipo 2", "Tipo 3"
  ],
  "decisiones_se_traba": [
    "Tipo 1 con <strong>palabras clave</strong>",
    "Tipo 2", "Tipo 3"
  ],
  "decisiones_regla": "Regla práctica corta y memorable (1 oración)",

  "ambientes_potencia": ["5 características del ambiente ideal — concretas, no clichés"],
  "ambientes_desgasta": ["5 características que lo desgastan — concretas"],
  "ambientes_jefe_ideal": "Párrafo describiendo el jefe ideal con <strong>rasgos clave</strong> (3-4 oraciones)",
  "ambientes_cultura": "Párrafo sobre la cultura ideal (3-4 oraciones)",
  "ambientes_entrevista_tips": "Párrafo introduciendo + 3 preguntas específicas para hacer al entrevistador",

  "liderazgo_intro": "Cómo lidera anclado en sus scores (2-3 oraciones)",
  "liderazgo_como_dirige": "Párrafo sobre su forma de dirigir (3-4 oraciones)",
  "liderazgo_como_forma": "Cómo desarrolla a su gente (3-4 oraciones)",
  "liderazgo_lo_cuesta": "Qué le cuesta como líder — específico (3-4 oraciones)",
  "liderazgo_recordatorio": "Recordatorio práctico para este perfil (2 oraciones)",
  "liderazgo_impacto_12_meses": "Qué pasa en su equipo después de un año (3-4 oraciones)",

  "entrevista_diferencial": "El diferencial real con <strong>frases clave</strong> (3-4 oraciones)",
  "entrevista_frases": [
    "Frase con punch 1 — no cliché",
    "Frase con punch 2",
    "Frase con punch 3",
    "Frase con punch 4"
  ],
  "entrevista_qa": [
    {"pregunta": "¿Cuál es tu mayor debilidad?", "respuesta": "Respuesta de 3-4 oraciones, alineada con su perfil, no enlatada", "por_que_funciona": "1 oración"},
    {"pregunta": "¿Cómo manejás conflictos?", "respuesta": "...", "por_que_funciona": "..."},
    {"pregunta": "Describí un error que cometiste.", "respuesta": "...", "por_que_funciona": "..."},
    {"pregunta": "¿Por qué dejaste tu último trabajo?", "respuesta": "...", "por_que_funciona": "..."}
  ],
  "entrevista_errores_comunes": ["4 errores típicos con <strong>palabras clave</strong>"],
  "entrevista_pitch_60_segundos": "Pitch de 60s natural, en primera persona, específico (4-5 oraciones)",

  "cierre_paragrafo_1": "Cierre personal por su nombre (2-3 oraciones)",
  "cierre_paragrafo_2": "Mensaje final sobre encontrar el contexto donde brilla (2-3 oraciones)"
}

Recordá scores reales: ${scores.foco}, ${scores.ritmo}, ${scores.estructura}, ${scores.comunicacion}.
EMPEZÁ AHORA TU RESPUESTA CON { (sin ningún texto previo).`;
}
