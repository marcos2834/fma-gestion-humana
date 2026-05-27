// GET /api/informe/[id]   (vía rewrite también desde /informe/[id])
// Sirve el HTML del informe generado.
import { list } from '@vercel/blob';

export default async function handler(req, res) {
  const { id } = req.query;
  const cleanId = String(id || '').replace(/[^a-f0-9]/g, '');

  if (!cleanId || cleanId.length < 8) {
    return notFound(res);
  }

  try {
    // Buscamos el blob por prefijo
    const { blobs } = await list({ prefix: `reports/${cleanId}` });
    const blob = blobs.find(b => b.pathname === `reports/${cleanId}.html`);

    if (!blob) return notFound(res);

    // Redirigimos al usuario al URL del blob (que sirve el HTML directamente)
    // Alternativa: fetch del blob y proxear el contenido. Más simple redirigir.
    const r = await fetch(blob.url);
    const html = await r.text();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.status(200).send(html);
  } catch (err) {
    console.error('Error sirviendo informe:', err);
    return notFound(res);
  }
}

function notFound(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(404).send(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Informe no encontrado</title>
<style>body{font-family:system-ui,sans-serif;background:#080D1A;color:#EFF3FF;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}.box{max-width:480px}h1{font-size:28px;margin:0 0 12px}p{color:#8B9ABF;line-height:1.6}a{color:#7DB84F;text-decoration:none;font-weight:600}</style></head>
<body><div class="box"><h1>🔍 Informe no encontrado</h1>
<p>El informe que estás buscando no existe o todavía no fue generado. Si recién pagaste, esperá 2-3 minutos y volvé a abrir el link del email.</p>
<p>Si pasaron más de 10 minutos, escribinos a <a href="mailto:hola@fmagestionhumana.com.ar">hola@fmagestionhumana.com.ar</a>.</p>
<p style="margin-top:32px"><a href="/">Volver a FMA Gestión Humana</a></p></div></body></html>`);
}
