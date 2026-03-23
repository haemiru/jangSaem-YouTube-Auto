/**
 * Netlify Edge Function — API proxy for production
 * Routes /api/anthropic/*, /api/youtube/*, /api/gemini/* to real APIs
 * Injects API keys from Netlify environment variables (server-side only)
 */

const ROUTES = {
  '/api/anthropic': {
    target: 'https://api.anthropic.com',
    getKey: () => process.env.ANTHROPIC_API_KEY,
    injectKey: (url, key, headers) => {
      headers['x-api-key'] = key;
      return url;
    },
  },
  '/api/youtube': {
    target: 'https://www.googleapis.com/youtube/v3',
    getKey: () => process.env.YOUTUBE_API_KEY,
    injectKey: (url, key) => {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}key=${key}`;
    },
  },
  '/api/gemini': {
    target: 'https://generativelanguage.googleapis.com/v1beta',
    getKey: () => process.env.GEMINI_API_KEY,
    injectKey: (url, key) => {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}key=${key}`;
    },
  },
};

export default async (request) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Find matching route
  const routePrefix = Object.keys(ROUTES).find(prefix => path.startsWith(prefix));
  if (!routePrefix) {
    return new Response('Not Found', { status: 404 });
  }

  const route = ROUTES[routePrefix];
  const apiKey = route.getKey();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured on server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build target URL
  const apiPath = path.replace(routePrefix, '') + url.search;
  let targetUrl = `${route.target}${apiPath}`;

  // Clone headers, remove browser-specific ones
  const headers = {};
  for (const [key, value] of request.headers.entries()) {
    if (!['host', 'origin', 'referer', 'x-api-key'].includes(key.toLowerCase())) {
      headers[key] = value;
    }
  }

  // Inject API key
  targetUrl = route.injectKey(targetUrl, apiKey, headers);

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' ? await request.text() : undefined,
    });

    // Forward response with CORS headers
    const responseHeaders = new Headers();
    for (const [key, value] of response.headers.entries()) {
      responseHeaders.set(key, value);
    }
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = {
  path: ['/api/anthropic/*', '/api/youtube/*', '/api/gemini/*'],
};
