// Genera el contenido personalizado del informe usando Claude (Anthropic).
// Modelo: Haiku 4.5 con prompt enriquecido (few-shot + style guides) para calidad premium.
import Anthropic from '@anthropic-ai/sdk';
import { PROFILES } from './profiles.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateReportContent(meta) {
  const profile = PROFILES[meta.profile_key];
  if (!profile) throw new Error(`Perfil desconocido: ${meta.profile_key}`);

  const scores = {
    foco: meta.foco,
    ritmo: meta.ritmo,
    estructura: meta.estructura,
    comunicacion: meta.comunicacion
  };

  const prompt = buildPrompt(meta, profile, scores);

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 6000,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text;
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Error parseando JSON de IA. Raw:', cleaned.slice(0, 500));
    return {
      intro_paragrafo_1: `${meta.name}, este es tu informe del perfil ${profile.name}.`,
      intro_paragrafo_2: 'Hubo un problema al personalizar la versión completa. Te enviamos esta base. Respondé este mail y te la regeneramos.',
      _fallback: true
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
ESTÁNDARES DE CALIDAD (CRÍTICO - leer 2 veces)
════════════════════════════════════════

🎯 ESTILO DE ESCRITURA:
- Español argentino: usá "vos", "tenés", "podés", "sabés" — NUNCA "tú", "tienes", "puedes"
- Tono: consultor experimentado hablando 1:1 con el usuario — cercano pero profesional, sin perder autoridad
- Frases cortas y con punch. Evitá frases largas con subordinadas anidadas
- Cero corporate-speak ("sinergias", "agregar valor", "stakeholders")
- Cero psico-fluff ("estás en un viaje de autoconocimiento", "abrazá tus fortalezas")

✅ EJEMPLOS DE BUENA REDACCIÓN (imitá este nivel):
"Tu foco está claramente en las personas (78%). Eso significa que cuando decidís, lo primero que pesás es 'cómo va a afectar a quienes están alrededor' — y recién después los datos. Es una fortaleza enorme en roles de líder de equipo. Es un cuello de botella en roles puramente analíticos."

"Donde más se nota tu rasgo reflexivo no es en reuniones grandes — ahí pasás desapercibido. Se nota en la calidad de los mails que mandás después: tres líneas precisas que sintetizan lo que tres personas dijeron en media hora."

❌ EVITÁ ABSOLUTAMENTE:
- "Sos una persona única" / "tu perfil te define" → genérico, vacío
- "Tu fortaleza es la empatía" → todos los perfiles dicen esto
- "Te recomendamos trabajar en..." → suena a libro de autoayuda
- Listas de adjetivos sin contexto ("responsable, comprometido, dedicado")
- Inicios genéricos como "Como [perfil], vos..."

🔍 PERSONALIZACIÓN OBLIGATORIA:
- Mencioná SCORES ESPECÍFICOS al menos 3-4 veces en todo el informe (ej: "tu 75% en ritmo reflexivo significa que...")
- Si Foco > 70: hablá explícitamente del lado "personas". Si Foco < 30: del lado "tareas". Si 30-70: matizá y mencioná balance.
- Misma lógica para los otros 3 ejes
- El estilo de decisión (${meta.reaction_value}) debe aparecer 1-2 veces en el informe

📐 LONGITUD POR SECCIÓN:
- Párrafos: 2-4 oraciones, no más
- Items de listas: 1-2 oraciones, concretas
- Bullets: 1 oración por bullet

════════════════════════════════════════
FORMATO DE RESPUESTA
════════════════════════════════════════

Devolvé SOLO un JSON válido (sin markdown, sin texto extra antes/después) con esta estructura EXACTA:

{
  "intro_paragrafo_1": "Párrafo de bienvenida personal — nómbralo, mencioná su perfil, conectá con un score específico fuerte",
  "intro_paragrafo_2": "Profundizá en la combinación de scores — qué pasa cuando esos 4 niveles se cruzan en él/ella específicamente",
  "intro_paragrafo_3": "Estilo de decisión: explicá qué significa ${meta.reaction_value} para alguien con este perfil",
  "intro_paragrafo_4": "Cierre tipo 'qué tipo de organizaciones te valoran'",

  "fortalezas": [
    {"titulo": "Título corto, evocativo, NO genérico", "descripcion": "2-3 oraciones específicas a sus scores", "donde_se_nota": "1 oración con un ejemplo CONCRETO de dónde se manifiesta"},
    {"titulo": "...", "descripcion": "...", "donde_se_nota": "..."},
    {"titulo": "...", "descripcion": "...", "donde_se_nota": "..."}
  ],

  "desarrollo": [
    {"titulo": "Título — algo a desarrollar, NO una debilidad-disculpa", "descripcion": "2-3 oraciones de por qué se da", "accion_concreta": "Una acción ESPECÍFICA para hacer esta semana, con detalle"},
    {"titulo": "...", "descripcion": "...", "accion_concreta": "..."},
    {"titulo": "...", "descripcion": "...", "accion_concreta": "..."}
  ],

  "comunicacion_bullets": ["4 marcas distintivas del estilo de comunicación. Usá <strong>palabras clave</strong>. Cada bullet 1-2 oraciones."],
  "comunicacion_malinterpretaciones": "Párrafo concreto: cómo otros perfiles lo perciben mal y por qué pasa",
  "comunicacion_recomendaciones": "Párrafo con 1-2 técnicas específicas (no genéricas)",

  "decisiones_intro": "Cómo decide, anclando en sus scores reales (no en abstracto)",
  "decisiones_rinde_mejor": ["3 tipos de decisiones donde es excelente. <strong>palabras clave</strong>. Cada item 1-2 oraciones."],
  "decisiones_se_traba": ["3 tipos donde se atasca. Mismas reglas."],
  "decisiones_regla": "Una regla práctica corta y memorable (ej: 'Si tardás más de 2 min en decidir si responder un mail, dejalo para mañana')",

  "ambientes_potencia": ["5 características del ambiente ideal. Específicas, no clichés."],
  "ambientes_desgasta": ["5 características que lo desgastan. Específicas."],
  "ambientes_jefe_ideal": "Párrafo describiendo el jefe ideal con <strong>rasgos clave</strong>",
  "ambientes_cultura": "Párrafo sobre la cultura organizacional ideal",
  "ambientes_entrevista_tips": "3 preguntas específicas que debería hacerle al entrevistador para detectar match cultural",

  "liderazgo_intro": "Cómo lidera (si lidera) o cómo lideraría — anclado en sus scores",
  "liderazgo_como_dirige": "Párrafo sobre su forma de dirigir",
  "liderazgo_como_forma": "Cómo desarrolla a su gente",
  "liderazgo_lo_cuesta": "Qué le cuesta como líder — específico",
  "liderazgo_recordatorio": "Un recordatorio práctico para este perfil específico",
  "liderazgo_impacto_12_meses": "Qué pasa en un equipo a su cargo después de un año",

  "entrevista_diferencial": "El diferencial real de este perfil en una entrevista, con <strong>frases clave</strong>",
  "entrevista_frases": ["4 frases listas para usar al describirse — no clichés, frases con punch que destaquen este perfil específico"],
  "entrevista_qa": [
    {"pregunta": "¿Cuál es tu mayor debilidad?", "respuesta": "Respuesta modelo de 3-4 oraciones, alineada con su perfil real, no la versión enlatada", "por_que_funciona": "1 oración explicando por qué esta respuesta funciona para este perfil"},
    {"pregunta": "¿Cómo manejás conflictos?", "respuesta": "...", "por_que_funciona": "..."},
    {"pregunta": "Describí un error que cometiste.", "respuesta": "...", "por_que_funciona": "..."},
    {"pregunta": "¿Por qué dejaste tu último trabajo?", "respuesta": "...", "por_que_funciona": "..."}
  ],
  "entrevista_errores_comunes": ["4 errores que perfiles como este cometen en entrevista. <strong>palabras clave</strong>."],
  "entrevista_pitch_60_segundos": "Pitch de 60s que el usuario podría memorizar — natural, específico a sus rasgos, en primera persona",

  "cierre_paragrafo_1": "Cierre personal por su nombre. Frase con punch.",
  "cierre_paragrafo_2": "Mensaje final sobre encontrar el contexto donde brilla — no cliché"
}

RECORDÁ:
- Mencioná scores reales: ${scores.foco}, ${scores.ritmo}, ${scores.estructura}, ${scores.comunicacion}
- Tu lector pagó $5000. Cada oración debe ser ÚTIL o BORRARLA.
- SOLO el JSON. Nada antes, nada después. Si dudás sobre comillas, escapá con \\".`;
}
