// POST /api/mercadopago-webhook-perfil
// Mercado Pago notifica acá cuando cambia el estado de un pago.
// Si está aprobado: genera el informe con IA, lo guarda en Blob, manda email.
//
// NOTA CRÍTICA: en Vercel Serverless, el código async DESPUÉS de res.send()
// NO se ejecuta — la función se termina con la respuesta. Por eso procesamos
// TODO inline antes de responder. MP tiene timeout ~22s pero reintenta;
// el check de blob existente evita doble procesamiento.
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { put, head } from '@vercel/blob';
import { PROFILES } from '../lib/profiles.js';
import { generateReportContent } from '../lib/ai-report.js';
import { renderReportHTML } from '../lib/render-report.js';
import { sendReportEmail } from '../lib/email-sender.js';

const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    const { type, data } = req.body || {};
    if (type !== 'payment' || !data?.id) {
      console.log('Webhook recibido sin payment ID, ignorando.', { type, data });
      return res.status(200).send('OK - not a payment event');
    }

    const paymentClient = new Payment(mp);
    const payment = await paymentClient.get({ id: data.id });

    if (payment.status !== 'approved') {
      console.log(`Pago ${data.id} status=${payment.status}, no se genera informe.`);
      return res.status(200).send('OK - not approved');
    }

    const meta = payment.metadata || {};
    if (!meta.report_id || !meta.email || !meta.profile_key) {
      console.error('Webhook: faltan datos en metadata', meta);
      return res.status(200).send('OK - missing metadata');
    }

    const blobKey = `reports/${meta.report_id}.html`;
    try {
      const existing = await head(blobKey);
      if (existing && existing.size > 0) {
        console.log(`Informe ${meta.report_id} ya existe, omitiendo regeneración.`);
        return res.status(200).send('OK - already processed');
      }
    } catch (_) {}

    console.log(`[webhook] Iniciando procesamiento para ${meta.email}, report_id=${meta.report_id}`);
    const t0 = Date.now();

    const profile = PROFILES[meta.profile_key];
    const scores = { foco: meta.foco, ritmo: meta.ritmo, estructura: meta.estructura, comunicacion: meta.comunicacion };

    console.log('[webhook] Llamando a Anthropic...');
    const content = await generateReportContent(meta);
    console.log(`[webhook] Anthropic OK (${Date.now() - t0}ms)`);

    const html = renderReportHTML({ meta, profile, scores, content });
    console.log(`[webhook] HTML renderizado (${html.length} bytes)`);

    await put(blobKey, html, { access: 'public', contentType: 'text/html; charset=utf-8', addRandomSuffix: false });
    console.log(`[webhook] Blob subido OK`);

    const baseUrl = process.env.APP_BASE_URL || 'https://fmagestionhumana.com.ar';
    const emailResult = await sendReportEmail({
      to: meta.email,
      name: meta.name,
      profileName: meta.profile_name,
      profileEmoji: profile.emoji,
      reportUrl: `${baseUrl}/informe/${meta.report_id}`
    });
    console.log(`[webhook] Email enviado a ${meta.email}, resendId=${emailResult.data?.id}, total=${Date.now() - t0}ms`);

    return res.status(200).send('OK - report delivered');
  } catch (err) {
    console.error('[webhook] ERROR:', err.message, err.stack?.split('\n').slice(0, 5).join(' | '));
    return res.status(500).send('Internal error: ' + err.message);
  }
}
