const { isAdmin, storageSet, getBody, supabase } = require('./_db');
const formidable = require('formidable');
const fs = require('fs');
const crypto = require('crypto');

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end();
  }

  if (!isAdmin(req)) {
    res.statusCode = 401;
    return res.json({ ok: false, error: 'unauthorized' });
  }

  const { type } = req.query;

  // --- MEDIA UPLOAD (REDIS) ---
  if (type === 'media') {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    const filenameHeader = req.headers['x-filename'];
    const maxBytes = contentType.startsWith('video/') ? 12_000_000 : 8_000_000;
    
    // For media we use raw buffer reading as before
    return new Promise((resolve) => {
      const chunks = [];
      let total = 0;
      req.on('data', chunk => {
        total += chunk.length;
        if (total <= maxBytes) chunks.push(chunk);
      });
      req.on('end', async () => {
        if (total > maxBytes) return res.json({ ok: false, error: 'too_large' });
        const body = Buffer.concat(chunks);
        const id = base64url(crypto.randomBytes(16));
        const filename = String(filenameHeader || 'media').replace(/[^a-zA-Z0-9._-]/g, '_');
        
        try {
          await storageSet(`media:${id}`, body);
          await storageSet(`mediaMeta:${id}`, JSON.stringify({ filename, contentType, size: body.length, createdAt: Date.now() }));
          res.json({ ok: true, url: `/api/media?id=${id}` });
        } catch (e) {
          res.json({ ok: false, error: e.message });
        }
        resolve();
      });
    });
  }

  // --- FACTURA UPLOAD (SUPABASE) ---
  if (type === 'factura') {
    const form = new formidable.IncomingForm();
    return new Promise((resolve) => {
      form.parse(req, async (err, fields, files) => {
        if (err || !files.file) return resolve(res.json({ ok: false, error: 'upload_failed' }));
        
        const file = Array.isArray(files.file) ? files.file[0] : files.file;
        const bucket = fields.bucket || 'facturas-pdf';
        const folder = fields.folder || 'general';

        try {
          const fileData = fs.readFileSync(file.filepath);
          const fileName = `${Date.now()}-${file.originalFilename}`;
          const filePath = `${folder}/${fileName}`;

          const { error } = await supabase.storage.from(bucket).upload(filePath, fileData, { contentType: file.mimetype });
          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
          res.json({ ok: true, url: publicUrl, path: filePath });
        } catch (e) {
          res.json({ ok: false, error: e.message });
        }
        resolve();
      });
    });
  }

  res.statusCode = 400;
  res.end();
};

if (!module.exports.json) {
  Object.defineProperty(Object.prototype, 'json', {
    value: function(data) {
      this.setHeader('Content-Type', 'application/json');
      this.end(JSON.stringify(data));
    },
    configurable: true,
    writable: true
  });
}
