// Envío del email con el link al informe usando Resend.
import { Resend } from 'resend';
import { escapeHTML } from './profiles.js';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendReportEmail({ to, name, profileName, profileEmoji, reportUrl, pdfBuffer }) {
  const firstName = (name || '').split(' ')[0] || name || 'hola';

  // Adjunto PDF (opcional — si falla la generación, mandamos el email sin él)
  const attachments = pdfBuffer ? [{
    filename: `mi-perfil-laboral-${(profileName || 'informe').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.pdf`,
    content: Buffer.from(pdfBuffer).toString('base64')
  }] : [];

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:32px 16px; background:#f5f7fa; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <tr>
      <td style="background:linear-gradient(135deg, #080D1A, #162033); padding:36px 32px; text-align:center;">
        <div style="font-size:18px; font-weight:800; color:#7DB84F; letter-spacing:0.02em;">FMA · Gestión Humana</div>
        <div style="font-size:13px; color:#8B9ABF; margin-top:4px;">Mi Perfil Laboral</div>
      </td>
    </tr>
    <tr>
      <td style="padding:40px 32px;">
        <div style="text-align:center; font-size:56px; line-height:1; margin-bottom:20px;">${profileEmoji}</div>
        <h1 style="font-size:24px; color:#1a1a1a; margin:0 0 16px; text-align:center; letter-spacing:-0.02em;">¡Hola ${escapeHTML(firstName)}!</h1>
        <p style="font-size:16px; color:#444; line-height:1.6; margin:0 0 20px;">Tu informe personalizado del perfil <strong>${escapeHTML(profileName)}</strong> está listo. Te tomó 10 minutos hacer el test, y nuestra IA armó un análisis único para vos basado en tus respuestas.</p>
        <p style="font-size:14px; color:#666; line-height:1.6; margin:0 0 28px;">Adentro vas a encontrar: análisis ampliado de tu perfil, tu estilo de comunicación y toma de decisiones, ambientes laborales donde brillás, y la sección estrella: <strong>cómo presentarte en entrevista según tu perfil</strong>.</p>
        <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
          <tr>
            <td style="background:linear-gradient(135deg, #6A9E48, #558035); border-radius:9999px;">
              <a href="${reportUrl}" style="display:inline-block; color:#ffffff; text-decoration:none; padding:16px 36px; font-size:15px; font-weight:700;">Ver mi informe completo &rarr;</a>
            </td>
          </tr>
        </table>
        <p style="font-size:13px; color:#999; line-height:1.5; margin:28px 0 0; text-align:center;">El informe queda guardado online · podés volver a verlo cuando quieras desde el link</p>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb; padding:24px 32px; border-top:1px solid #e5e7eb; font-size:12px; color:#888; text-align:center; line-height:1.6;">
        ¿Dudas o problemas? Respondé este mail.<br>
        <strong>FMA Gestión Humana</strong> · fmagestionhumana.com.ar
      </td>
    </tr>
  </table>
</body></html>`;

  return await resend.emails.send({
    from: 'FMA Gestión Humana <hola@fmagestionhumana.com.ar>',
    to,
    subject: `${firstName}, tu informe "${profileName}" está listo 🎉`,
    html,
    attachments
  });
}
