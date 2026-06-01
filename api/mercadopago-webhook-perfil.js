// POST /api/mercadopago-webhook-perfil
// Notificación de Mercado Pago. Procesa pago aprobado, genera informe, manda mail.
// Loggea cada invocación a Vercel Blob para debugging.
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { put, head } from '@vercel/blob';
import { PROFILES } from '../lib/profiles.js';
import { generateReportContent } from '../lib/ai-report.js';
import { renderReportHTML } from '../lib/render-report.js';
import { sendReportEmail } from '../lib/email-sender.js';

const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
export const config = { maxDuration: 60 };

async function debugLog(label, data) {
  try {
    const ts = Date.now();
    const key = `debug/webhook-${ts}-${label}.json`;
    await put(key, JSON.stringify({ts: new Date().toISOString(), label, data}, null, 2), {
      access: 'public', contentType: 'application/json', addRandomSuffix: false
    });
  } catch (e) { /* no-op */ }
}

export default async function handler(req, res) {
  // Log inmediato: confirmar invocación
  await debugLog('called', {
    method: req.method,
    headers: { 'user-agent': req.headers['user-agent']?.slice(0,80), 'x-signature': req.headers['x-signature']?.slice(0,40) },
    body: req.body,
    query: req.query,
    url: req.url
  });

  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { type, data } = req.body || {};
    if (type !== 'payment' || !data?.id) {
      await debugLog('skipped-not-payment', { type, data });
      return res.status(200).send('OK - not a payment event');
    }

    const paymentClient = new Payment(mp);
    const payment = await paymentClient.get({ id: data.id });
    await debugLog('payment-fetched', { id: data.id, status: payment.status, metadata: payment.metadata });

    if (payment.status !== 'approved') return res.status(200).send('OK - not approved');

    const meta = payment.metadata || {};
    if (!meta.report_id || !meta.email || !meta.profile_key) {
      await debugLog('missing-meta', meta);
      return res.status(200).send('OK - missing metadata');
    }

    const blobKey = `reports/${meta.report_id}.html`;
    try {
      const existing = await head(blobKey);
      if (existing && existing.size > 0) {
        await debugLog('already-processed', { report_id: meta.report_id });
        return res.status(200).send('OK - already processed');
      }
    } catch (_) {}

    const t0 = Date.now();
    await debugLog('processing-start', { email: meta.email, profile: meta.profile_key });
    
    const profile = PROFILES[meta.profile_key];
    const scores = { foco: meta.foco, ritmo: meta.ritmo, estructura: meta.estructura, comunicacion: meta.comunicacion };

    const content = await generateReportContent(meta);
    await debugLog('anthropic-done', { ms: Date.now() - t0 });

    const html = renderReportHTML({ meta, profile, scores, content });
    await put(blobKey, html, { access: 'public', contentType: 'text/html; charset=utf-8', addRandomSuffix: false });
    await debugLog('blob-uploaded', { bytes: html.length, ms: Date.now() - t0 });

    const baseUrl = process.env.APP_BASE_URL || 'https://fmagestionhumana.com.ar';
    const emailResult = await sendReportEmail({
      to: meta.email, name: meta.name, profileName: meta.profile_name,
      profileEmoji: profile.emoji, reportUrl: `${baseUrl}/informe/${meta.report_id}`
    });
    await debugLog('email-sent', { to: meta.email, resendId: emailResult.data?.id, error: emailResult.error, totalMs: Date.now() - t0 });

    return res.status(200).send('OK - report delivered');
  } catch (err) {
    await debugLog('caught-error', { msg: err.message, stack: err.stack?.split('\n').slice(0,5).join(' | ') });
    return res.status(500).send('Internal error: ' + err.message);
  }
}
