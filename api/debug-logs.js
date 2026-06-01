import { list, put } from '@vercel/blob';

export default async function handler(req, res) {
  const marker = 'v2-' + Date.now();
  if (req.query?.test === 'put') {
    try {
      const result = await put('debug/manual-test-' + Date.now() + '.json', JSON.stringify({test:true}), { access: 'public', addRandomSuffix: false });
      return res.status(200).json({ marker, put_success: true, url: result.url });
    } catch(e) { return res.status(500).json({ marker, put_error: e.message }); }
  }
  try {
    const { blobs } = await list({ prefix: req.query?.prefix || 'debug/', limit: 100 });
    const sorted = blobs.map(b => ({pathname: b.pathname, size: b.size, uploaded: String(b.uploadedAt), url: b.url})).sort((a,b) => b.uploaded.localeCompare ? b.uploaded.localeCompare(a.uploaded) : 0);
    if (req.query?.list === '1') return res.status(200).json({ marker, count: blobs.length, blobs: sorted.slice(0,30) });
    const items = [];
    for (const b of sorted.slice(0,20)) { try { const r = await fetch(b.url); items.push({key:b.pathname, uploaded:b.uploaded, content: r.ok ? await r.json() : 'fetch-failed'}); } catch(e) { items.push({key:b.pathname, fetch_err: e.message}); } }
    res.status(200).json({ marker, count: blobs.length, items });
  } catch (e) { res.status(500).json({ marker, list_error: e.message }); }
}
