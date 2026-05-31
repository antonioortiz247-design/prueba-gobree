const { isAdmin, storageSet, getBody, supabase, sendJSON } = require('./_db');
const formidable = require('formidable');
const fs = require('fs');
const crypto = require('crypto');

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return sendJSON(res, { error: 'Method Not Allowed' }, 405);
  }

  if (!isAdmin(req)) {
    return sendJSON(res, { ok: false, error: 'unauthorized' }, 401);
  }

  const { type } = req.query;

  // --- MEDIA UPLOAD (REDIS) ---
  if (type === 'media') {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    const filenameHeader = req.headers['x-filename'];
    const maxBytes = contentType.startsWith('video/') ? 12_000_000 : 8_000_000;
    
    return new Promise((resolve) => {
      const chunks = [];
      let total = 0;
      req.on('data', chunk => {
        total += chunk.length;
        if (total <= maxBytes) chunks.push(chunk);
      });
      req.on('end', async () => {
        if (total > maxBytes) {
          sendJSON(res, { ok: false, error: 'too_large' });
          return resolve();
        }
        const body = Buffer.concat(chunks);
        const id = base64url(crypto.randomBytes(16));
        const filename = String(filenameHeader || 'media').replace(/[^a-zA-Z0-9._-]/g, '_');
        
        try {
          await storageSet(`media:${id}`, body);
          await storageSet(`mediaMeta:${id}`, JSON.stringify({ filename, contentType, size: body.length, createdAt: Date.now() }));
          sendJSON(res, { ok: true, url: `/api/media?id=${id}` });
        } catch (e) {
          sendJSON(res, { ok: false, error: e.message });
        }
        resolve();
      });
    });
  }

  // --- FACTURA UPLOAD (SUPABASE) ---
  if (type === 'factura') {
    if (!supabase) {
      return sendJSON(res, { ok: false, error: 'Supabase not configured' }, 500);
    }
    const form = new formidable.IncomingForm();
    return new Promise((resolve) => {
      form.parse(req, async (err, fields, files) => {
        if (err || !files.file) {
          sendJSON(res, { ok: false, error: 'upload_failed' });
          return resolve();
        }
        
        const file = Array.isArray(files.file) ? files.file[0] : files.file;
        const bucket = (Array.isArray(fields.bucket) ? fields.bucket[0] : fields.bucket) || 'facturas-pdf';
        const folder = (Array.isArray(fields.folder) ? fields.folder[0] : fields.folder) || 'general';

        try {
          const fileData = fs.readFileSync(file.filepath);
          const fileName = `${Date.now()}-${file.originalFilename}`;
          const filePath = `${folder}/${fileName}`;

          const { error } = await supabase.storage.from(bucket).upload(filePath, fileData, { contentType: file.mimetype });
          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
          sendJSON(res, { ok: true, url: publicUrl, path: filePath });
        } catch (e) {
          sendJSON(res, { ok: false, error: e.message });
        }
        resolve();
      });
    });
  }

  return sendJSON(res, { error: 'Invalid type' }, 400);
};
