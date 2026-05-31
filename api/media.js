const { storageGet, storageGetBuffer, sendJSON } = require('./_db');

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
    return sendJSON(res, { error: 'Method Not Allowed' }, 405);
  }

  const id = getQueryParam(req.url, 'id');
  if (!id) {
    return sendJSON(res, { error: 'Missing id' }, 400);
  }

  const dataKey = `media:${id}`;
  const metaKey = `mediaMeta:${id}`;

  try {
    const metaRaw = await storageGet(metaKey);
    const buf = await storageGetBuffer(dataKey);

    if (!buf) {
      return sendJSON(res, { error: 'Not found' }, 404);
    }

    let meta = {};
    if (metaRaw) {
      try {
        meta = JSON.parse(metaRaw);
      } catch (e) {}
    }

    const contentType = meta.contentType || 'application/octet-stream';
    const filename = meta.filename || 'download';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(buf);
  } catch (e) {
    console.error('Media Error:', e);
    return sendJSON(res, { error: 'Internal Server Error' }, 500);
  }
};
