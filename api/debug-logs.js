import { list } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    const { blobs } = await list({ prefix: 'debug/', limit: 50 });
    blobs.sort((a,b) => b.uploadedAt.localeCompare(a.uploadedAt));
    const results = [];
    for (const blob of blobs.slice(0, 20)) {
      const r = await fetch(blob.url);
      const data = await r.json();
      results.push({ key: blob.pathname, size: blob.size, uploaded: blob.uploadedAt, ...data });
    }
    res.status(200).json({ count: blobs.length, recent: results });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
