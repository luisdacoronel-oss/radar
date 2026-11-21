// RADAR · Links exactos de productos
// Las IA a veces devuelven links genéricos (búsquedas, portadas) o publicaciones que ya no existen.
// Este módulo reconoce si un link es una publicación exacta, lo verifica abriéndolo y, si no hay ninguno
// válido, arma links de búsqueda que siempre funcionan (Mercado Libre, AliExpress, Amazon, Google Shopping).

const EXACTOS = [
  ['Mercado Libre', /mercadolibre\.com\.ar\/(?:.*\/p\/MLA\d+|.*MLA-?\d{6,})|articulo\.mercadolibre\.com\.ar\/MLA-?\d+/i],
  ['AliExpress', /aliexpress\.[a-z.]+\/item\/\d+/i],
  ['Amazon', /amazon\.[a-z.]+\/(?:[^?]*\/)?(?:dp|gp\/product)\/[A-Z0-9]{10}/i],
  ['Temu', /temu\.com\/[^?]*-g-\d+\.html/i],
  ['Alibaba', /alibaba\.com\/product-detail\//i],
  ['Shein', /shein\.com\/[^?]*-p-\d+/i],
  ['CJ Dropshipping', /cjdropshipping\.com\/product\//i],
  ['DHgate', /dhgate\.com\/product\//i],
];
const GENERICO = /\/(search|buscar|busqueda|listado|wholesale|s\?|w\/|category|categoria|c\/)|[?&](q|k|keyword|SearchText)=|listado\.mercadolibre|vertexaisearch|google\.[a-z.]+\/search/i;

export function plataformaExacta(url) {
  const u = String(url || '');
  if (!/^https?:\/\//i.test(u)) return null;
  for (const [n, re] of EXACTOS) if (re.test(u)) return n;
  // otras tiendas: aceptar páginas de producto con ruta propia (no búsquedas ni portadas)
  try { const x = new URL(u); if (!GENERICO.test(u) && x.pathname.split('/').filter(Boolean).length >= 1 && x.pathname.length > 8) return x.hostname.replace(/^www\./, '') } catch { }
  return null;
}

// Abre el link y confirma que sigue siendo una publicación (si redirige a una búsqueda, no sirve)
export async function verificar(url) {
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36', 'Accept-Language': 'es-AR,es;q=0.9' } });
    const final = r.url || url;
    if (r.status === 403 || r.status === 429 || r.status === 503) return { ok: null, final }; // el sitio no deja verificar: se acepta si el formato es de publicación
    if (r.status >= 400) return { ok: false, final };
    if (GENERICO.test(final) && !GENERICO.test(url)) return { ok: false, final }; // la publicación ya no existe y mandó a una búsqueda
    const t = (await r.text()).slice(0, 300000);
    if (/mercadolibre/.test(final) && /publicaci[oó]n (pausada|finalizada)|ya no est[aá] disponible/i.test(t)) return { ok: false, final };
    // foto real de la publicación (og:image), para no mostrar imágenes rotas
    const im = (t.match(/<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) || t.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i) || [])[1];
    return { ok: true, final, imagen: im && /^https?:\/\//.test(im) && !/no-?photo|placeholder|logo/i.test(im) ? im.replace(/&amp;/g, '&') : null };
  } catch { return { ok: null, final: url } }
}

// Foto oficial de una publicación de Mercado Libre usando su API pública (cuando la página no deja leer la foto)
export async function imagenML(url) {
  const id = (String(url).match(/MLA-?(\d{6,})/i) || [])[1]; if (!id) return null;
  const catalogo = /\/p\/MLA/i.test(url);
  for (const u of catalogo ? [`https://api.mercadolibre.com/products/MLA${id}`, `https://api.mercadolibre.com/items/MLA${id}`] : [`https://api.mercadolibre.com/items/MLA${id}`, `https://api.mercadolibre.com/products/MLA${id}`]) {
    try { const r = await fetch(u, { signal: AbortSignal.timeout(10000) }); if (!r.ok) continue; const j = await r.json(); const f = j.pictures?.[0]; const im = f?.secure_url || f?.url; if (im) return im.replace(/^http:/, 'https:') } catch { }
  }
  return null;
}

export function busquedas(nombre) {
  const q = String(nombre || '').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
  const guiones = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-');
  return {
    mercadolibre: `https://listado.mercadolibre.com.ar/${guiones}`,
    aliexpress: `https://www.aliexpress.com/w/wholesale-${encodeURIComponent(q).replace(/%20/g, '-')}.html`,
    amazon: `https://www.amazon.com/s?k=${encodeURIComponent(q)}`,
    google: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}`,
  };
}

// Elige el mejor link de un producto: primero una publicación exacta y verificada; si no hay, búsquedas
export async function mejorLink(nombre, candidatos, verificarLinks = true) {
  const vistos = new Set();
  const lista = candidatos.filter(c => c?.url && !vistos.has(c.url) && vistos.add(c.url));
  let dudoso = null;
  for (const c of lista) {
    const plat = plataformaExacta(c.url);
    if (!plat) continue;
    if (!verificarLinks) return { url: c.url, plataforma: c.plataforma || plat, exacto: true, verificado: false, busquedas: busquedas(nombre) };
    const v = await verificar(c.url);
    if (v.ok === true) return { url: v.final || c.url, plataforma: c.plataforma || plat, exacto: true, verificado: true, imagen: v.imagen || (/mercadolibre/i.test(v.final || c.url) ? await imagenML(v.final || c.url) : null), busquedas: busquedas(nombre) };
    if (v.ok === null && !dudoso) dudoso = { url: c.url, plataforma: c.plataforma || plat, exacto: true, verificado: false, imagen: /mercadolibre/i.test(c.url) ? await imagenML(c.url) : null, busquedas: busquedas(nombre) };
  }
  if (dudoso) return dudoso;
  const b = busquedas(nombre);
  return { url: b.mercadolibre, plataforma: 'Búsqueda en Mercado Libre', exacto: false, verificado: false, busquedas: b };
}

// Candidatos de un producto de RADAR (orden de preferencia: Mercado Libre, fuente principal, proveedores, otros mercados)
export function candidatosProducto(p) {
  const pm = p.precios_mercados || [];
  return [
    ...pm.filter(m => /mercado ?libre/i.test(m.mercado || '')).map(m => ({ url: m.url, plataforma: 'Mercado Libre' })),
    { url: p.fuente_principal?.url, plataforma: p.fuente_principal?.plataforma },
    ...(p.proveedores || []).map(x => ({ url: x.url, plataforma: x.plataforma || x.proveedor })),
    ...pm.map(m => ({ url: m.url, plataforma: m.mercado })),
  ];
}
