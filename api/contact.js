const nodemailer = require('nodemailer');

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 200_000) reject(new Error('payload_too_large'));
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch (e) {
        reject(new Error('invalid_json'));
      }
    });
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false }));
    return;
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const mailTo = process.env.CONTACT_TO || 'contacto@gobreebelt.com';
  const mailFrom = process.env.CONTACT_FROM || smtpUser;

  if (!smtpHost || !smtpUser || !smtpPass || !mailFrom) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'missing_smtp_env' }));
    return;
  }

  let data;
  try {
    data = await readJson(req);
  } catch (e) {
    res.statusCode = e.message === 'payload_too_large' ? 413 : 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: e.message }));
    return;
  }

  const nombre = String(data.nombre || '').trim().slice(0, 120);
  const email = String(data.email || '').trim().slice(0, 180);
  const telefono = String(data.telefono || '').trim().slice(0, 60);
  const industria = String(data.industria || '').trim().slice(0, 120);
  const mensaje = String(data.mensaje || '').trim().slice(0, 5000);
  const source = String(data.source || '').trim().slice(0, 200);

  if (!nombre || !email) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'missing_fields' }));
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass }
  });

  const text = [
    'Nueva solicitud desde el sitio web (Gobree Belt).',
    '',
    nombre ? `Nombre: ${nombre}` : '',
    email ? `Correo: ${email}` : '',
    telefono ? `Teléfono: ${telefono}` : '',
    industria ? `Industria: ${industria}` : '',
    source ? `Origen: ${source}` : '',
    '',
    'Mensaje:',
    mensaje || '(sin mensaje)'
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await transporter.sendMail({
      from: mailFrom,
      to: mailTo,
      replyTo: email || undefined,
      subject: `Solicitud desde sitio: ${nombre}`,
      text
    });
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'send_failed' }));
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
};
