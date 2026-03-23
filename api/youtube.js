export default async function handler(req, res) {
  const path = req.url.replace(/^\/api\/youtube/, '') || '/';
  const separator = path.includes('?') ? '&' : '?';
  const target = `https://www.googleapis.com/youtube/v3${path}${separator}key=${process.env.YOUTUBE_API_KEY}`;

  try {
    const response = await fetch(target, { method: req.method });
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('content-type', contentType);

    const data = await response.text();
    res.status(response.status).send(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
