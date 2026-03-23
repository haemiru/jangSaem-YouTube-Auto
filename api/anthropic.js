export default async function handler(req, res) {
  try {
    const path = req.url.replace(/^\/api\/anthropic/, '') || '/';
    const target = `https://api.anthropic.com${path}`;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const headers = {
      'content-type': 'application/json',
      'anthropic-version': req.headers['anthropic-version'] || '2023-06-01',
      'x-api-key': apiKey,
    };

    const body = req.method !== 'GET' && req.method !== 'HEAD'
      ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
      : undefined;

    const response = await fetch(target, {
      method: req.method,
      headers,
      body,
    });

    const data = await response.text();

    res.setHeader('content-type', response.headers.get('content-type') || 'application/json');
    res.status(response.status).send(data);
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}
