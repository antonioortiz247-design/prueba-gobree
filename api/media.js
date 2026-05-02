const { createClient, commandOptions } = require('redis');

let redisClient;
let redisConnecting;

async function getRedisClient() {
  if (redisClient) return redisClient;
  if (redisConnecting) return redisConnecting;

  redisConnecting = (async () => {
    const redisUrl = process.env.REDIS_URL;
    const host = process.env.REDIS_HOST;
    const port = Number(process.env.REDIS_PORT || '');
    const username = process.env.REDIS_USERNAME || process.env.REDIS_USER;
    const password = process.env.REDIS_PASSWORD || process.env.REDIS_PASS;

    if (!redisUrl && !host) throw new Error('missing_redis_env');

    const useTlsEnv = String(process.env.REDIS_TLS || '').toLowerCase();
    const inferredTls =
      (Number.isFinite(port) && port !== 6379) || String(host || '').includes('cloud.redislabs.com');
    const useTls = useTlsEnv ? useTlsEnv === 'true' : inferredTls;

    const client = redisUrl
      ? createClient({ url: redisUrl })
      : createClient({
          username: username || undefined,
          password: password || undefined,
          socket: {
            host,
            port: Number.isFinite(port) ? port : 6379,
            tls: useTls,
            servername: useTls ? host : undefined
          }
        });

    client.on('error', () => {});
    await client.connect();
    redisClient = client;
    return redisClient;
  })();

  return redisConnecting;
}

function getQueryParam(url, key) {
  const u = String(url || '');
  const qIndex = u.indexOf('?');
  if (qIndex === -1) return '';
  const query = u.slice(qIndex + 1);
  const parts = query.split('&');
  for (const p of parts) {
    const [k, v] = p.split('=');
    if (k === key) {
      try {
        return decodeURIComponent(v || '');
      } catch (e) {
        return String(v || '');
      }
    }
  }
  return '';
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  const id = getQueryParam(req.url, 'id');
  if (!id) {
    res.statusCode = 400;
    res.end('Missing id');
    return;
  }

  let client;
  try {
    client = await getRedisClient();
  } catch (e) {
    res.statusCode = 502;
    res.end('Storage not configured');
    return;
  }

  const dataKey = `media:${id}`;
  const metaKey = `mediaMeta:${id}`;

  let metaRaw;
  let buf;
  try {
    metaRaw = await client.get(metaKey);
    buf = await client.get(commandOptions({ returnBuffers: true }), dataKey);
  } catch (e) {
    res.statusCode = 500;
    res.end('Storage error');
    return;
  }

  if (!buf || !buf.length) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  let contentType = 'application/octet-stream';
  if (metaRaw) {
    try {
      const meta = JSON.parse(metaRaw);
      if (meta && meta.contentType) contentType = String(meta.contentType);
    } catch (e) {}
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.end(buf);
};

