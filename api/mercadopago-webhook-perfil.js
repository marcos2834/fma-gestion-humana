// POST /api/mercadopago-webhook-perfil
// Mercado Pago notifica acá cuando cambia el estado de un pago.
// Si está aprobado: genera el informe con IA, lo guarda en Blob, manda email.
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { put, head } from '@vercel/blob';
import { PROFILES } from '../lib/profiles.js';
import { generateReportContent } from '../lib/ai-report.js';
import { renderReportHTML } from '../lib/render-report.js';
import { sendReportEmail } from '../lib/email-sender.js';

const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  // Respondemos rápido para que MP no reintente, después seguimos procesando
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  // Ack a Mercado Pago lo antes posible
  res.status(200).send('OK');

  try {
    const { type, data } = req.body || {};
    if (type !== 'payment' || !data?.id) {
      console.log('Webhook recibido sin payment ID, ignorando.', { type, data });
      return;
    }

    const paymentClient = new Payment(mp);
    const payment = await paymentClient.get({ id: data.id });

    if (payment.status !== 'approved') {
      console.log(`Pago ${data.id} status=${payment.status}, no se genera informe.`);
      return;
    }

    const meta = payment.metadata || {};
    if (!meta.report_id || !meta.email || !meta.profile_key) {
      console.error('Webhook: faltan datos en metadata', meta);
      return;
    }

    // Evitar doble procesamiento — chequear si el blob ya existe
    const blobKey = `reports/${meta.report_id}.html`;
    try {
      const existing = await head(blobKey);
      if (existing && existing.size > 0) {
        console.log(`Informe ${meta.report_id} ya existe, omitiendo regeneración.`);
        return;
      }
    } catch (_) {
      // No existe, continuamos
    }

    console.log(`Generando informe ${meta.report_id} para ${meta.email}...`);

    const profile = PROFILES[meta.profile_key];
    const scores = {
      foco: meta.foco,
      ritmo: meta.ritmo,
      estructura: meta.estructura,
      comunicacion: meta.comunicacion
    };

    // 1) Generar contenido personalizado con Claude
    const content = await generateReportContent(meta);

    // 2) Renderizar HTML final del informe
    const html = renderReportHTML({ meta, profile, scores, content });

    // 3) Subir a Vercel Blob (público pero con URL imposible de adivinar)
    await put(blobKey, html, {
      access: 'public',
      contentType: 'text/html; charset=utf-8',
      addRandomSuffix: false
    });

    // 4) Enviar email con link al informe
    const baseUrl = process.env.APP_BASE_URL || 'https://fmagestionhumana.com.ar';
    await sendReportEmail({
      to: meta.email,
      name: meta.name,
      profileName: meta.profile_name,
      profileEmoji: profile.emoji,
      reportUrl: `${baseUrl}/informe/${meta.report_id}`
    });

    console.log(`Informe ${meta.report_id} entregado a ${meta.email}.`);
  } catch (err) {
    console.error('Error procesando webhook:', err);
  }
}
