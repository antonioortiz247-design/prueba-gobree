const { isAdmin, storageGet, storageSet, storageKeys, storageDel, getBody, sendJSON } = require('./_db');

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
        return sendJSON(res, { images: data ? JSON.parse(data) : [] });
      }
      if (type === 'products') {
        const data = await storageGet(KEYS.PRODUCTS);
        return sendJSON(res, { products: data ? JSON.parse(data) : [] });
      }
      if (type === 'projects') {
        const data = await storageGet(KEYS.PROJECTS);
        return sendJSON(res, { projects: data ? JSON.parse(data) : [] });
      }
      if (type === 'media') {
        const data = await storageGet(KEYS.MEDIA);
        return sendJSON(res, { media: data ? JSON.parse(data) : [] });
      }
    }

    // --- WRITE OPERATIONS (ADMIN ONLY) ---
    if (!isAdmin(req)) {
      return sendJSON(res, { ok: false, error: 'unauthorized' }, 401);
    }

    if (req.method === 'POST') {
      const body = await getBody(req);
      if (type === 'hero') {
        await storageSet(KEYS.HERO, JSON.stringify(body.images || []));
        return sendJSON(res, { ok: true });
      }
      if (type === 'products') {
        await storageSet(KEYS.PRODUCTS, JSON.stringify(body.products || []));
        return sendJSON(res, { ok: true });
      }
      if (type === 'projects') {
        await storageSet(KEYS.PROJECTS, JSON.stringify(body.projects || []));
        return sendJSON(res, { ok: true });
      }
      if (type === 'media') {
        await storageSet(KEYS.MEDIA, JSON.stringify(body.media || []));
        return sendJSON(res, { ok: true });
      }
      
      // Cleanup logic
      if (type === 'cleanup') {
        const allKeys = await storageKeys('*');
        const usedKeys = Object.values(KEYS);
        const keysToDelete = allKeys.filter(k => !usedKeys.includes(k) && !k.startsWith('_') && !k.startsWith('media:') && !k.startsWith('mediaMeta:'));
        if (req.query.run === 'true') {
          for (const k of keysToDelete) await storageDel(k);
          return sendJSON(res, { ok: true, deleted: keysToDelete });
        }
        return sendJSON(res, { ok: true, pending: keysToDelete });
      }
    }

    return sendJSON(res, { error: 'Method Not Allowed' }, 405);
  } catch (e) {
    return sendJSON(res, { ok: false, error: e.message }, 500);
  }
};
