module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false }));
    return;
  }

  res.statusCode = 200;
  res.setHeader('Set-Cookie', ['gobree_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax']);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
};
