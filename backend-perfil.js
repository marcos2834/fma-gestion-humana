/**
 * ============================================================
 *  FMA · Mi Perfil Laboral — Backend endpoints
 *  Drop-in para agregar al servidor Express existente.
 * ============================================================
 *
 *  Endpoints:
 *    POST /api/create-perfil-payment
 *    POST /api/mercadopago-webhook-perfil
 *    GET  /informe/:id        (sirve el informe HTML)
 *
 *  Variables de entorno necesarias (.env):
 *    MP_ACCESS_TOKEN=APP_USR-xxxxx          ← Mercado Pago (producción)
 *    MP_WEBHOOK_SECRET=xxx                  ← opcional, para validar firma
 *    ANTHROPIC_API_KEY=sk-ant-xxxxx         ← Claude API (genera el informe)
 *    RESEND_API_KEY=re_xxxxx                ← Resend (envío de email)
 *    APP_BASE_URL=https://fmagestionhumana.com.ar
 *    REPORTS_DIR=/var/data/reports          ← dónde guardar informes generados
 *
 *  Dependencias npm:
 *    npm install mercadopago @anthropic-ai/sdk resend express
 *
 * ============================================================
 */

const express = require('express');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const Anthropic = require('@anthropic-ai/sdk');
const { Resend } = require('resend');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// ============================================================
// CONFIG
// ============================================================
const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://fmagestionhumana.com.ar';
const REPORTS_DIR = process.env.REPORTS_DIR || './reports';
const PRICE_ARS = 4990;

// Asegurar que existe la carpeta de informes
fs.mkdir(REPORTS_DIR, { recursive: true }).catch(() => {});

// ============================================================
// PROFILES — el mismo catálogo que tenés en perfil.html
//   (necesario para que la IA genere informe consistente)
// ============================================================
const PROFILES = {
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

// ============================================================
// ROUTES
// ============================================================
const router = express.Router();

/**
 * POST /api/create-perfil-payment
 * Recibe los datos del test y crea una preferencia de Mercado Pago.
 * Devuelve init_point (URL del checkout) al frontend.
 */
router.post('/api/create-perfil-payment', async (req, res) => {
  try {
    const { name, email, profile_key, profile_name, scores, reaction_value, reaction_avg_seconds } = req.body;

    // Validaciones básicas
    if (!name || !email || !profile_key || !scores) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    if (!PROFILES[profile_key]) {
      return res.status(400).json({ error: 'Perfil inválido' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    // Generar ID único para este informe
    const reportId = crypto.randomBytes(12).toString('hex');

    // Crear preferencia en Mercado Pago.
    // Mandamos todos los datos del test en metadata para recuperarlos en el webhook.
    const preference = new Preference(mp);
    const pref = await preference.create({
      body: {
        items: [{
          id: `informe-perfil-${profile_key}`,
          title: `Informe Premium · ${profile_name}`,
          description: `Informe personalizado del perfil laboral "${profile_name}" generado con IA`,
          quantity: 1,
          unit_price: PRICE_ARS,
          currency_id: 'ARS'
        }],
        payer: {
          name: name.split(' ')[0] || name,
          surname: name.split(' ').slice(1).join(' ') || '',
          email
        },
        back_urls: {
          success: `${APP_BASE_URL}/mi-perfil-laboral?status=approved`,
          pending: `${APP_BASE_URL}/mi-perfil-laboral?status=pending`,
          failure: `${APP_BASE_URL}/mi-perfil-laboral?status=failure`
        },
        auto_return: 'approved',
        notification_url: `${APP_BASE_URL}/api/mercadopago-webhook-perfil`,
        external_reference: reportId,
        metadata: {
          report_id: reportId,
          name,
          email,
          profile_key,
          profile_name,
          foco: scores.foco,
          ritmo: scores.ritmo,
          estructura: scores.estructura,
          comunicacion: scores.comunicacion,
          reaction_value,
          reaction_avg_seconds
        }
      }
    });

    res.json({ init_point: pref.init_point, report_id: reportId });
  } catch (err) {
    console.error('Error en create-perfil-payment:', err);
    res.status(500).json({ error: 'No se pudo crear el pago: ' + err.message });
  }
});

/**
 * POST /api/mercadopago-webhook-perfil
 * Recibe la notificación de Mercado Pago cuando un pago cambia de estado.
 * Si el pago está aprobado, genera el informe con IA y lo manda por email.
 */
router.post('/api/mercadopago-webhook-perfil', async (req, res) => {
  // Mercado Pago llama varias veces — respondemos rápido y procesamos async
  res.status(200).send('OK');

  try {
    const { type, data } = req.body;
    if (type !== 'payment') return;

    const paymentClient = new Payment(mp);
    const payment = await paymentClient.get({ id: data.id });

    if (payment.status !== 'approved') {
      console.log(`Pago ${data.id} con status ${payment.status} — no genera informe.`);
      return;
    }

    const meta = payment.metadata || {};
    if (!meta.report_id || !meta.email || !meta.profile_key) {
      console.error('Webhook: faltan datos en metadata', meta);
      return;
    }

    // Evitar doble procesamiento: verificar si el informe ya existe
    const reportPath = path.join(REPORTS_DIR, `${meta.report_id}.html`);
    try {
      await fs.access(reportPath);
      console.log(`Informe ${meta.report_id} ya existe, omitiendo regeneración.`);
      return;
    } catch (_) { /* no existe, sigo */ }

    console.log(`Generando informe ${meta.report_id} para ${meta.email}...`);
    const html = await generatePersonalizedReport(meta);
    await fs.writeFile(reportPath, html, 'utf8');

    await sendReportEmail({
      to: meta.email,
      name: meta.name,
      profileName: meta.profile_name,
      reportUrl: `${APP_BASE_URL}/informe/${meta.report_id}`
    });

    console.log(`Informe ${meta.report_id} entregado a ${meta.email}.`);
  } catch (err) {
    console.error('Error procesando webhook:', err);
  }
});

/**
 * GET /informe/:id
 * Sirve el HTML del informe generado al usuario.
 */
router.get('/informe/:id', async (req, res) => {
  const id = req.params.id.replace(/[^a-f0-9]/g, '');
  if (!id) return res.status(404).send('Informe no encontrado');
  try {
    const html = await fs.readFile(path.join(REPORTS_DIR, `${id}.html`), 'utf8');
    res.type('html').send(html);
  } catch (err) {
    res.status(404).send('Informe no encontrado o todavía no está listo. Si recién pagaste, esperá 2-3 minutos.');
  }
});

// ============================================================
// AI GENERATION
// ============================================================

/**
 * Genera el HTML completo del informe personalizado usando Claude.
 * El template base es el que vimos en informe-sample.html.
 */
async function generatePersonalizedReport(meta) {
  const profile = PROFILES[meta.profile_key];
  const scores = {
    foco: meta.foco, ritmo: meta.ritmo,
    estructura: meta.estructura, comunicacion: meta.comunicacion
  };

  const prompt = buildReportPrompt(meta, profile, scores);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }]
  });

  const generatedContent = response.content[0].text;
  return wrapReportHTML(meta, profile, scores, generatedContent);
}

function buildReportPrompt(meta, profile, scores) {
  return `Sos un consultor de RRHH especializado en perfiles conductuales. Vas a generar el contenido personalizado del informe premium "Mi Perfil Laboral" para una persona real.

DATOS DEL USUARIO:
- Nombre: ${meta.name}
- Perfil detectado: ${profile.name} ${profile.emoji}
- Lema del perfil: "${profile.lema}"
- Scores (escala 0-100):
  · Foco (0=Tareas, 100=Personas): ${scores.foco}
  · Ritmo (0=Acción rápida, 100=Reflexión): ${scores.ritmo}
  · Estructura (0=Estructurado, 100=Flexible): ${scores.estructura}
  · Comunicación (0=Directa, 100=Diplomática): ${scores.comunicacion}
- Estilo de decisión: ${meta.reaction_value} (promedio ${meta.reaction_avg_seconds}s por escenario)

GENERÁ CONTENIDO PERSONALIZADO PARA LAS SIGUIENTES SECCIONES, en formato JSON estricto. Tuteá al usuario por su nombre. Tono: profesional pero cercano, español argentino. Cada sección debe estar PERSONALIZADA a los scores específicos (no genérica del perfil).

Devolvé un JSON con esta estructura exacta:

{
  "intro_paragrafo_1": "1 párrafo dirigido al usuario por su nombre, conectando su perfil con su nivel específico en las 4 dimensiones",
  "intro_paragrafo_2": "1 párrafo profundizando en las implicancias de su combinación específica de scores",
  "intro_paragrafo_3": "1 párrafo sobre su estilo de decisión y cómo se manifiesta en su rol",
  "intro_paragrafo_4": "1 párrafo cerrando con qué tipo de organizaciones valoran más a personas como él/ella",

  "fortalezas": [
    {"titulo": "...", "descripcion": "párrafo extenso", "donde_se_nota": "tip concreto"},
    {"titulo": "...", "descripcion": "...", "donde_se_nota": "..."},
    {"titulo": "...", "descripcion": "...", "donde_se_nota": "..."}
  ],

  "desarrollo": [
    {"titulo": "...", "descripcion": "...", "accion_concreta": "acción específica esta semana"},
    {"titulo": "...", "descripcion": "...", "accion_concreta": "..."},
    {"titulo": "...", "descripcion": "...", "accion_concreta": "..."}
  ],

  "comunicacion_bullets": ["4 marcas distintivas del estilo de comunicación de esta persona, en HTML con <strong>"],
  "comunicacion_malinterpretaciones": "párrafo sobre cómo lo perciben mal y por qué",
  "comunicacion_recomendaciones": "párrafo con recomendaciones prácticas",

  "decisiones_intro": "párrafo introductorio sobre su manera de decidir",
  "decisiones_rinde_mejor": ["3 tipos de decisiones donde rinde mejor"],
  "decisiones_se_traba": ["3 tipos de decisiones donde se traba"],
  "decisiones_regla": "1 regla útil específica para este perfil",

  "ambientes_potencia": ["5 características del contexto que lo potencia"],
  "ambientes_desgasta": ["5 características del contexto que lo desgasta"],
  "ambientes_jefe_ideal": "párrafo sobre el jefe ideal",
  "ambientes_cultura": "párrafo sobre la cultura organizacional ideal",
  "ambientes_entrevista_tips": "párrafo con 3 preguntas específicas para hacer en entrevista",

  "liderazgo_intro": "párrafo introductorio",
  "liderazgo_como_dirige": "párrafo",
  "liderazgo_como_forma": "párrafo",
  "liderazgo_lo_cuesta": "párrafo",
  "liderazgo_recordatorio": "1 recordatorio importante para este perfil",
  "liderazgo_impacto_12_meses": "párrafo sobre el impacto típico en un año",

  "entrevista_diferencial": "párrafo destacando el diferencial de este perfil en una entrevista",
  "entrevista_frases": ["4 frases recomendadas para usar al describir su manera de trabajar"],
  "entrevista_qa": [
    {"pregunta": "¿Cuál es tu mayor debilidad?", "respuesta": "respuesta modelo personalizada", "por_que_funciona": "explicación corta"},
    {"pregunta": "¿Cómo manejás conflictos?", "respuesta": "...", "por_que_funciona": "..."},
    {"pregunta": "Describí un error que cometiste.", "respuesta": "...", "por_que_funciona": "..."},
    {"pregunta": "¿Por qué dejaste tu último trabajo?", "respuesta": "...", "por_que_funciona": "..."}
  ],
  "entrevista_errores_comunes": ["4 errores que comete este perfil en entrevista, en HTML con <strong>"],
  "entrevista_pitch_60_segundos": "pitch de 60 segundos personalizado al perfil",

  "cierre_paragrafo_1": "párrafo de cierre dirigido por nombre",
  "cierre_paragrafo_2": "párrafo sobre encontrar el contexto donde brilla"
}

IMPORTANTE: devolvé SOLO el JSON, sin markdown, sin explicaciones antes ni después. Asegurate de que el JSON sea válido (escapá comillas internas si hace falta).`;
}

/**
 * Envuelve el contenido generado por IA en el template HTML del informe.
 * Esto es el mismo HTML que armaste en informe-sample.html pero con los placeholders
 * reemplazados por el contenido personalizado.
 */
function wrapReportHTML(meta, profile, scores, generatedContentRaw) {
  let content;
  try {
    // Limpiar posible markdown wrapper
    const cleaned = generatedContentRaw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    content = JSON.parse(cleaned);
  } catch (err) {
    console.error('Error parseando JSON de IA:', err, generatedContentRaw.slice(0, 500));
    // Fallback: contenido genérico
    content = {
      intro_paragrafo_1: `${meta.name}, este es tu informe del perfil ${profile.name}.`,
      intro_paragrafo_2: 'Hubo un problema al generar la versión personalizada. Te enviamos esta versión base.',
      intro_paragrafo_3: '', intro_paragrafo_4: '',
      fortalezas: [], desarrollo: [],
      comunicacion_bullets: [], comunicacion_malinterpretaciones: '', comunicacion_recomendaciones: '',
      decisiones_intro: '', decisiones_rinde_mejor: [], decisiones_se_traba: [], decisiones_regla: '',
      ambientes_potencia: [], ambientes_desgasta: [], ambientes_jefe_ideal: '',
      ambientes_cultura: '', ambientes_entrevista_tips: '',
      liderazgo_intro: '', liderazgo_como_dirige: '', liderazgo_como_forma: '',
      liderazgo_lo_cuesta: '', liderazgo_recordatorio: '', liderazgo_impacto_12_meses: '',
      entrevista_diferencial: '', entrevista_frases: [], entrevista_qa: [],
      entrevista_errores_comunes: [], entrevista_pitch_60_segundos: '',
      cierre_paragrafo_1: '', cierre_paragrafo_2: ''
    };
  }

  // El template HTML es muy largo — para mantener este archivo legible, lo cargás
  // desde un archivo externo. Si querés todo en un archivo, podés inlinear el contenido
  // de informe-sample.html acá reemplazando los placeholders.
  //
  // Por simplicidad, asumimos que tenés un archivo template-informe.html con placeholders
  // {{USER_NAME}}, {{PROFILE_NAME}}, {{INTRO_P1}}, etc.

  return renderReportTemplate({
    user: meta.name,
    profileName: profile.name,
    profileEmoji: profile.emoji,
    profileLema: profile.lema,
    scores,
    reactionValue: meta.reaction_value,
    reactionAvgSeconds: meta.reaction_avg_seconds,
    content,
    date: new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }),
    reportId: meta.report_id
  });
}

/**
 * Renderiza el HTML final del informe.
 * USAR el HTML de informe-sample.html como base, con los siguientes reemplazos:
 *   - Datos del usuario (nombre, fecha, número de informe)
 *   - Datos del perfil (emoji, nombre, lema)
 *   - Scores reales (los 4 porcentajes y las barras)
 *   - Tags del perfil (5 tags)
 *   - Contenido generado por IA en cada sección
 *
 * Para mantener este snippet acotado, te lo dejo como función que cargás desde disco.
 * Tomá el contenido de informe-sample.html, reemplazá los placeholders y devolvés el HTML.
 */
async function renderReportTemplate(data) {
  // Cargá el template (usá informe-sample.html como base y agregale placeholders {{XXX}})
  const tpl = await fs.readFile(path.join(__dirname, 'template-informe.html'), 'utf8');

  // Reemplazos
  let html = tpl
    .replace(/\{\{USER_NAME\}\}/g, escapeHTML(data.user))
    .replace(/\{\{PROFILE_NAME\}\}/g, escapeHTML(data.profileName))
    .replace(/\{\{PROFILE_EMOJI\}\}/g, data.profileEmoji)
    .replace(/\{\{PROFILE_LEMA\}\}/g, escapeHTML(data.profileLema))
    .replace(/\{\{DATE\}\}/g, escapeHTML(data.date))
    .replace(/\{\{REPORT_ID\}\}/g, escapeHTML(data.reportId))
    .replace(/\{\{SCORE_FOCO\}\}/g, String(data.scores.foco))
    .replace(/\{\{SCORE_RITMO\}\}/g, String(data.scores.ritmo))
    .replace(/\{\{SCORE_ESTRUCTURA\}\}/g, String(data.scores.estructura))
    .replace(/\{\{SCORE_COMUNICACION\}\}/g, String(data.scores.comunicacion))
    .replace(/\{\{REACTION_VALUE\}\}/g, escapeHTML(data.reactionValue))
    .replace(/\{\{REACTION_AVG\}\}/g, String(data.reactionAvgSeconds))
    // Contenido generado por IA
    .replace(/\{\{INTRO_P1\}\}/g, data.content.intro_paragrafo_1 || '')
    .replace(/\{\{INTRO_P2\}\}/g, data.content.intro_paragrafo_2 || '')
    .replace(/\{\{INTRO_P3\}\}/g, data.content.intro_paragrafo_3 || '')
    .replace(/\{\{INTRO_P4\}\}/g, data.content.intro_paragrafo_4 || '')
    // ... continuá con todos los placeholders del template
    ;
  return html;
}

function escapeHTML(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============================================================
// EMAIL
// ============================================================
async function sendReportEmail({ to, name, profileName, reportUrl }) {
  const firstName = name.split(' ')[0] || name;
  await resend.emails.send({
    from: 'FMA Gestión Humana <hola@fmagestionhumana.com.ar>',
    to,
    subject: `${firstName}, tu informe "${profileName}" está listo 🎉`,
    html: `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f5f7fa; padding:32px; margin:0;">
  <table cellpadding="0" cellspacing="0" style="max-width:560px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <tr><td style="background:linear-gradient(135deg, #080D1A, #162033); padding:40px 32px; text-align:center;">
      <div style="font-size:18px; font-weight:800; color:#7DB84F; letter-spacing:0.02em;">FMA · Gestión Humana</div>
    </td></tr>
    <tr><td style="padding:40px 32px;">
      <h1 style="font-size:24px; color:#1a1a1a; margin:0 0 16px; letter-spacing:-0.02em;">¡Hola ${escapeHTML(firstName)}!</h1>
      <p style="font-size:16px; color:#444; line-height:1.6; margin:0 0 20px;">Tu informe personalizado del perfil <strong>${escapeHTML(profileName)}</strong> está listo. Te tomó 10 minutos hacer el test y nuestra IA armó un informe único para vos.</p>
      <p style="font-size:14px; color:#666; line-height:1.6; margin:0 0 28px;">Adentro vas a encontrar: análisis ampliado de tu perfil, tu estilo de comunicación y toma de decisiones, ambientes laborales donde brillás, y la sección estrella: <strong>cómo presentarte en entrevista según tu perfil</strong>.</p>
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="background:linear-gradient(135deg, #6A9E48, #558035); border-radius:9999px; box-shadow:0 4px 16px rgba(106,158,72,0.35);">
        <a href="${reportUrl}" style="display:inline-block; color:#fff; text-decoration:none; padding:16px 36px; font-size:15px; font-weight:700;">Ver mi informe completo →</a>
      </td></tr></table>
      <p style="font-size:13px; color:#999; line-height:1.5; margin:28px 0 0; text-align:center;">El informe se guarda online · podés volver a verlo desde el link cuando quieras</p>
    </td></tr>
    <tr><td style="background:#f9fafb; padding:24px 32px; border-top:1px solid #e5e7eb; font-size:12px; color:#888; text-align:center;">
      ¿Dudas o problemas? Respondé este mail.<br>
      FMA Gestión Humana · fmagestionhumana.com.ar
    </td></tr>
  </table>
</body></html>`
  });
}

// ============================================================
// EXPORT
// ============================================================
module.exports = router;

// Si querés usarlo standalone: const app = express(); app.use(router); app.listen(3000);
