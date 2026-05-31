const { isAdmin, storageGet, storageSet, storageKeys, storageDel, getBody } = require('./_db');

const KEYS = {
  HERO: 'hero_images_v2',
  PRODUCTS: 'products_v1',
  PROJECTS: 'projects_v2',
  MEDIA: 'media_v1'
};

module.exports = async (req, res) => {
  const { type } = req.query;

  try {
    // --- READ OPERATIONS (PUBLIC) ---
    if (req.method === 'GET') {
      if (type === 'hero') {
        const data = await storageGet(KEYS.HERO);
        return res.json({ images: data ? JSON.parse(data) : [] });
      }
      if (type === 'products') {
        const data = await storageGet(KEYS.PRODUCTS);
        return res.json({ products: data ? JSON.parse(data) : [] });
      }
      if (type === 'projects') {
        const data = await storageGet(KEYS.PROJECTS);
        return res.json({ projects: data ? JSON.parse(data) : [] });
      }
      if (type === 'media') {
        const data = await storageGet(KEYS.MEDIA);
        return res.json({ media: data ? JSON.parse(data) : [] });
      }
    }

    // --- WRITE OPERATIONS (ADMIN ONLY) ---
    if (!isAdmin(req)) {
      res.statusCode = 401;
      return res.json({ ok: false, error: 'unauthorized' });
    }

    if (req.method === 'POST') {
      const body = await getBody(req);
      if (type === 'hero') {
        await storageSet(KEYS.HERO, JSON.stringify(body.images || []));
        return res.json({ ok: true });
      }
      if (type === 'products') {
        await storageSet(KEYS.PRODUCTS, JSON.stringify(body.products || []));
        return res.json({ ok: true });
      }
      if (type === 'projects') {
        await storageSet(KEYS.PROJECTS, JSON.stringify(body.projects || []));
        return res.json({ ok: true });
      }
      if (type === 'media') {
        await storageSet(KEYS.MEDIA, JSON.stringify(body.media || []));
        return res.json({ ok: true });
      }
      
      // Cleanup logic
      if (type === 'cleanup') {
        const allKeys = await storageKeys('*');
        const usedKeys = Object.values(KEYS);
        const keysToDelete = allKeys.filter(k => !usedKeys.includes(k) && !k.startsWith('_'));
        if (req.query.run === 'true') {
          for (const k of keysToDelete) await storageDel(k);
          return res.json({ ok: true, deleted: keysToDelete });
        }
        return res.json({ ok: true, pending: keysToDelete });
      }
    }

    res.statusCode = 405;
    res.end();
  } catch (e) {
    res.statusCode = 500;
    res.json({ ok: false, error: e.message });
  }
};

// Helper for res.json since we aren't using Express
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
