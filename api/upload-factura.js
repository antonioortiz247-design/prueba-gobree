const { supabase, isAdmin } = require('./_supabase');
const formidable = require('formidable');
const fs = require('fs');

module.exports = async (req, res) => {
  if (!isAdmin(req)) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: 'Error parseando archivo' }));
    }

    const file = files.file;
    const bucket = fields.bucket || 'facturas-pdf';
    const folder = fields.folder || 'general';

    if (!file) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: 'No se subió ningún archivo' }));
    }

    try {
      const fileData = fs.readFileSync(file.filepath);
      const fileName = `${Date.now()}-${file.originalFilename}`;
      const filePath = `${folder}/${fileName}`;

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, fileData, {
          contentType: file.mimetype,
          upsert: false
        });

      if (error) throw error;

      // Obtener URL pública (o firmada si es privado)
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, url: publicUrl, path: filePath }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  });
};
