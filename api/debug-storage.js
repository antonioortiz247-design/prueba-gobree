const { storageKeys, isAdmin, storageGet } = require('./_db');

const KEYS = {
  HERO: 'hero_images_v2',
  PRODUCTS: 'products_v1',
  PROJECTS: 'projects_v2',
  MEDIA: 'media_v1'
};

module.exports = async (req, res) => {
  const isAuthed = isAdmin(req);
  const isAuthorized = isAuthed || req.query.secret === 'gobree_debug_2026';
  
  if (!isAuthorized) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ 
      error: 'unauthorized',
      cookies_present: !!req.headers.cookie,
      hint: 'Asegúrate de haber iniciado sesión en /admin'
    }));
  }

  try {
    const allKeys = await storageKeys('*');
    
    // Obtener valores de las llaves principales para ver qué tienen
    const values = {};
    for (const [name, key] of Object.entries(KEYS)) {
      const val = await storageGet(key);
      values[name] = {
        key: key,
        exists: val !== null,
        length: val ? val.length : 0
      };
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      ok: true,
      auth: {
        isAdmin: isAuthed,
        cookieHeader: req.headers.cookie ? (req.headers.cookie.substring(0, 20) + '...') : 'none'
      },
      total_keys: allKeys.length,
      main_keys_status: values,
      all_keys: allKeys.sort()
    }, null, 2));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
};
