// Genera el contenido personalizado del informe usando Claude (Anthropic).
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
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text;
  // Limpiar markdown wrapping si lo hubiera
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Error parseando JSON de IA. Raw:', cleaned.slice(0, 500));
    // Fallback mínimo para no romper si la IA devuelve algo raro
    return {
      intro_paragrafo_1: `${meta.name}, este es tu informe del perfil ${profile.name}.`,
      intro_paragrafo_2: 'Hubo un problema al personalizar la versión completa. Te enviamos esta base. Si necesitás la versión completa, respondé este mail y te la generamos de nuevo.',
      _fallback: true
    };
  }
}

function buildPrompt(meta, profile, scores) {
  return `Sos un consultor senior de RRHH especializado en perfiles conductuales. Vas a generar el contenido personalizado del informe premium "Mi Perfil Laboral" para una persona real.

DATOS DEL USUARIO:
- Nombre: ${meta.name}
- Perfil detectado: ${profile.name} ${profile.emoji}
- Lema del perfil: "${profile.lema}"
- Scores en 4 dimensiones (escala 0-100):
  · Foco (0=Tareas, 100=Personas): ${scores.foco}
  · Ritmo (0=Acción rápida, 100=Reflexión): ${scores.ritmo}
  · Estructura (0=Estructurado, 100=Flexible): ${scores.estructura}
  · Comunicación (0=Directa, 100=Diplomática): ${scores.comunicacion}
- Estilo de decisión: ${meta.reaction_value} (promedio ${meta.reaction_avg_seconds}s por escenario)

Generá contenido personalizado para las siguientes secciones, en formato JSON estricto. Tuteá al usuario por su nombre. Tono: profesional pero cercano, español argentino (usá "vos", "tenés", no "tú"). Cada sección debe estar PERSONALIZADA a los scores específicos del usuario, no genérica del perfil.

Devolvé un JSON con esta estructura exacta:

{
  "intro_paragrafo_1": "1 párrafo dirigido al usuario por su nombre, conectando su perfil con su nivel específico en las 4 dimensiones",
  "intro_paragrafo_2": "1 párrafo profundizando en las implicancias de su combinación específica de scores",
  "intro_paragrafo_3": "1 párrafo sobre su estilo de decisión y cómo se manifiesta en su rol",
  "intro_paragrafo_4": "1 párrafo cerrando con qué tipo de organizaciones valoran más a personas como él/ella",

  "fortalezas": [
    {"titulo": "...", "descripcion": "párrafo extenso", "donde_se_nota": "tip concreto de dónde se observa"},
    {"titulo": "...", "descripcion": "...", "donde_se_nota": "..."},
    {"titulo": "...", "descripcion": "...", "donde_se_nota": "..."}
  ],

  "desarrollo": [
    {"titulo": "...", "descripcion": "...", "accion_concreta": "acción específica esta semana"},
    {"titulo": "...", "descripcion": "...", "accion_concreta": "..."},
    {"titulo": "...", "descripcion": "...", "accion_concreta": "..."}
  ],

  "comunicacion_bullets": ["4 marcas distintivas del estilo de comunicación. Permití HTML con <strong> en términos clave"],
  "comunicacion_malinterpretaciones": "párrafo sobre cómo lo perciben mal y por qué",
  "comunicacion_recomendaciones": "párrafo con recomendaciones prácticas",

  "decisiones_intro": "párrafo introductorio sobre su manera de decidir",
  "decisiones_rinde_mejor": ["3 tipos de decisiones donde rinde mejor, en HTML con <strong>"],
  "decisiones_se_traba": ["3 tipos de decisiones donde se traba, en HTML con <strong>"],
  "decisiones_regla": "1 regla útil específica para este perfil",

  "ambientes_potencia": ["5 características del contexto que lo potencia"],
  "ambientes_desgasta": ["5 características del contexto que lo desgasta"],
  "ambientes_jefe_ideal": "párrafo sobre el jefe ideal con <strong>",
  "ambientes_cultura": "párrafo sobre la cultura organizacional ideal",
  "ambientes_entrevista_tips": "párrafo con 3 preguntas específicas para hacer al entrevistador",

  "liderazgo_intro": "párrafo introductorio",
  "liderazgo_como_dirige": "párrafo",
  "liderazgo_como_forma": "párrafo",
  "liderazgo_lo_cuesta": "párrafo",
  "liderazgo_recordatorio": "1 recordatorio importante para este perfil",
  "liderazgo_impacto_12_meses": "párrafo sobre el impacto típico en un año",

  "entrevista_diferencial": "párrafo destacando el diferencial de este perfil en una entrevista, con <strong>",
  "entrevista_frases": ["4 frases recomendadas para usar al describir su manera de trabajar"],
  "entrevista_qa": [
    {"pregunta": "¿Cuál es tu mayor debilidad?", "respuesta": "respuesta modelo personalizada al perfil", "por_que_funciona": "explicación corta"},
    {"pregunta": "¿Cómo manejás conflictos?", "respuesta": "...", "por_que_funciona": "..."},
    {"pregunta": "Describí un error que cometiste.", "respuesta": "...", "por_que_funciona": "..."},
    {"pregunta": "¿Por qué dejaste tu último trabajo?", "respuesta": "...", "por_que_funciona": "..."}
  ],
  "entrevista_errores_comunes": ["4 errores típicos de este perfil en entrevista, HTML con <strong>"],
  "entrevista_pitch_60_segundos": "pitch de 60 segundos personalizado",

  "cierre_paragrafo_1": "párrafo de cierre dirigido por nombre",
  "cierre_paragrafo_2": "párrafo sobre encontrar el contexto donde brilla"
}

IMPORTANTE:
- Devolvé SOLO el JSON, sin markdown wrapping, sin explicaciones antes ni después.
- Asegurate de que el JSON sea válido (escapá comillas internas, usá comillas dobles para keys y values).
- Las "tags" del perfil (5 rasgos cortos como "Analítico", "Detallista") las maneja la app, no las generes vos.
- Personalizá según los scores específicos. Por ejemplo, si Foco es 85, hablá de cómo se manifiesta esa alta orientación a personas. Si Foco es 55, matizá.`;
}
