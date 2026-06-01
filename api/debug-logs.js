import { list, put } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.query?.test === 'put') {
    try {
      const result = await put('debug/manual-test-' + Date.now() + '.json', JSON.stringify({test:true, ts: new Date().toISOString()}), { access: 'public', contentType: 'application/json', addRandomSuffix: false });
      return res.status(200).json({ put_success: true, url: result.url });
    } catch(e) { return res.status(500).json({ put_error: e.message, name: e.name }); }
  }
  const prefix = req.query?.prefix || 'debug/';
  try {
    const { blobs } = await list({ prefix, limit: 100 });
    blobs.sort((a,b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    if (req.query?.list === '1') {
      return res.status(200).json({ count: blobs.length, blobs: blobs.slice(0,20).map(b => ({pathname: b.pathname, size: b.size, uploaded: b.uploadedAt})) });
    }
    const results = [];
    for (const blob of blobs.slice(0, 20)) {
      try { const r = await fetch(blob.url); const data = await r.json(); results.push({ key: blob.pathname, uploaded: blob.uploadedAt, ...data }); } catch(e) { results.push({ key: blob.pathname, fetch_err: e.message }); }
    }
    res.status(200).json({ count: blobs.length, items: results });
  } catch (e) { res.status(500).json({ list_error: e.message, stack: e.stack?.split('\n').slice(0,3) }); }
}
