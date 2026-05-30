// GET /api/test-pdf-email?email=tu@email.com
// Endpoint diagnóstico: prueba PDF + email aislado de MP.
// Devuelve JSON con cada paso para identificar dónde falla.
import { Resend } from 'resend';
import { generatePDF } from '../lib/pdf-generator.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const email = req.query?.email || 'test@example.com';
  const diagnostic = {
    timestamp: new Date().toISOString(),
    env: {
      hasResend: !!process.env.RESEND_API_KEY,
      hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
      hasMP: !!process.env.MP_ACCESS_TOKEN,
      hasBlob: !!process.env.BLOB_READ_WRITE_TOKEN,
      hasBaseUrl: !!process.env.APP_BASE_URL,
      resendKeyPrefix: process.env.RESEND_API_KEY?.slice(0, 6) + '...',
    },
    steps: {}
  };

  // Paso 1: probar generación de PDF
  try {
    const testHtml = `<!DOCTYPE html><html><head><title>Test</title></head><body style="font-family:sans-serif;padding:40px"><h1>Test PDF</h1><p>Generado el ${new Date().toISOString()}</p></body></html>`;
    const start = Date.now();
    const pdf = await generatePDF(testHtml);
    diagnostic.steps.pdf = {
      ok: true,
      durationMs: Date.now() - start,
      sizeBytes: pdf.length
    };
    diagnostic.pdf = pdf; // guardamos para el siguiente paso
  } catch (e) {
    diagnostic.steps.pdf = { ok: false, error: e.message, stack: e.stack?.split('\n').slice(0, 5).join(' | ') };
  }

  // Paso 2: probar envío de email
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const start = Date.now();
    const attachments = diagnostic.pdf ? [{
      filename: 'test-diagnostico.pdf',
      content: Buffer.from(diagnostic.pdf).toString('base64')
    }] : [];

    const result = await resend.emails.send({
      from: 'FMA Gestión Humana <hola@fmagestionhumana.com.ar>',
      to: email,
      subject: '🧪 Test diagnóstico FMA',
      html: '<h1>Test diagnóstico</h1><p>Si recibís este mail, el flujo email funciona.</p>' +
            (diagnostic.pdf ? '<p>📎 Tiene un PDF adjunto de prueba.</p>' : '<p>⚠️ El PDF no se pudo generar.</p>'),
      attachments
    });

    diagnostic.steps.email = {
      ok: !result.error,
      durationMs: Date.now() - start,
      resendId: result.data?.id,
      error: result.error
    };
  } catch (e) {
    diagnostic.steps.email = { ok: false, error: e.message };
  }

  delete diagnostic.pdf; // no devolver el binario
  return res.status(200).json(diagnostic);
}
