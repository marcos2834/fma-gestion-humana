import { list, put } from '@vercel/blob';

export default async function handler(req, res) {
  // ?test=put -> intenta escribir un blob de prueba
  if (req.query?.test === 'put') {
    try {
      const result = await put('debug/manual-test-' + Date.now() + '.json', JSON.stringify({test:true, ts: new Date().toISOString()}), { access: 'public', contentType: 'application/json', addRandomSuffix: false });
      return res.status(200).json({ put_success: true, url: result.url, downloadUrl: result.downloadUrl });
    } catch(e) { return res.status(500).json({ put_error: e.message, name: e.name, stack: e.stack?.split('\n').slice(0,5) }); }
  }
  const prefix = req.query?.prefix || '';
  try {
    const { blobs } = await list({ prefix, limit: 100 });
    blobs.sort((a,b) => b.uploadedAt.localeCompare(a.uploadedAt));
    res.status(200).json({ env: { hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN, tokenPrefix: process.env.BLOB_READ_WRITE_TOKEN?.slice(0,18) }, count: blobs.length, blobs: blobs.slice(0,15).map(b => ({pathname: b.pathname, size: b.size, uploaded: b.uploadedAt})) });
  } catch (e) { res.status(500).json({ list_error: e.message }); }
}
