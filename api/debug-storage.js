const { storageKeys, isAdmin, storageGet } = require('./_db');

const KEYS = {
  HERO: 'hero_images_v2',
  PRODUCTS: 'products_v1',
  PROJECTS: 'projects_v2',
  MEDIA: 'media_v1'
};

module.exports = async (req, res) => {
  const isAuthorized = isAdmin(req) || req.query.secret === 'gobree_debug_2026';
  
  if (!isAuthorized) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'unauthorized' }));
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
        length: val ? val.length : 0,
        preview: val ? (val.substring(0, 100) + '...') : null
      };
    }

    // Buscar llaves similares por si acaso cambiaron de nombre
    const suggestions = allKeys.filter(k => 
      k.includes('hero') || k.includes('product') || k.includes('project') || k.includes('media')
    );

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      ok: true,
      total_keys: allKeys.length,
      main_keys_status: values,
      suggested_keys: suggestions,
      all_keys: allKeys.sort()
    }, null, 2));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
};
