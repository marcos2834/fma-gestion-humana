import { list } from '@vercel/blob';

export default async function handler(req, res) {
  const prefix = req.query?.prefix || '';
  try {
    const { blobs } = await list({ prefix, limit: 100 });
    blobs.sort((a,b) => b.uploadedAt.localeCompare(a.uploadedAt));
    const list_only = req.query?.list === '1';
    if (list_only) {
      return res.status(200).json({ count: blobs.length, blobs: blobs.slice(0,20).map(b => ({pathname: b.pathname, size: b.size, uploaded: b.uploadedAt})) });
    }
    const results = [];
    for (const blob of blobs.slice(0, 15)) {
      if (!blob.pathname.endsWith('.json')) { results.push({key: blob.pathname, size: blob.size, uploaded: blob.uploadedAt, type: 'non-json'}); continue; }
      const r = await fetch(blob.url);
      const data = await r.json();
      results.push({ key: blob.pathname, size: blob.size, uploaded: blob.uploadedAt, ...data });
    }
    res.status(200).json({ count: blobs.length, items: results });
  } catch (e) { res.status(500).json({ error: e.message, stack: e.stack?.split('\n').slice(0,3) }); }
}
