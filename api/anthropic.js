export default async function handler(req, res) {
  const path = req.url.replace(/^\/api\/anthropic/, '') || '/';
  const target = `https://api.anthropic.com${path}`;

  const headers = { ...req.headers };
  // Inject API key
  headers['x-api-key'] = process.env.ANTHROPIC_API_KEY;
  // Clean up headers that shouldn't be forwarded
  delete headers.host;
  delete headers.origin;
  delete headers.referer;

  try {
    const response = await fetch(target, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    // Forward response headers
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('content-type', contentType);

    const data = await response.text();
    res.status(response.status).send(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
