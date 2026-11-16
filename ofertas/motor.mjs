#!/usr/bin/env node
// RADAR · Ofertas y reventa
// Dos veces por día busca ofertas reales en internet (rotando categorías), verifica si el descuento es real
// comparando con el historial de precios y con el precio de mercado, calcula cuánto se gana revendiendo
// en Mercado Libre y en la web propia (con la calculadora de RADAR), clasifica cada oportunidad y arma
// el ranking de las 20 que más conviene comprar para revender.
// Cada oportunidad responde: qué comprar, dónde, a qué precio, a cuánto vender, cuánto invertir,
// cuánto se gana realmente y qué riesgos tiene.
//
// Uso: node ofertas/motor.mjs        ·   SIMULAR=1 node ofertas/motor.mjs (prueba sin internet)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { usarConfig, rentab, rentabWeb, num } from '../lib/calc.mjs';
import { crearIA, usarMock } from '../lib/ia.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAL = path.join(RAIZ, 'docs', 'ofertas-datos');
const SIM = process.env.SIMULAR === '1';
fs.mkdirSync(SAL, { recursive: true });
const leer = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return d } };
const cfg = leer(path.join(RAIZ, 'ofertas', 'config.json'), {});
const cfgRadar = leer(path.join(RAIZ, 'config.json'), {});
const ahora = new Date().toISOString(), hoy = ahora.slice(0, 10);
const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const segura = u => /^https?:\/\//i.test(String(u || '')) ? String(u) : '';

// ---------- estado ----------
const estado = leer(path.join(SAL, 'estado.json'), { vuelta: 0, ia: {} });
const historial = leer(path.join(SAL, 'historial-precios.json'), {});
const previas = leer(path.join(SAL, 'ofertas.json'), { ofertas: [], tendencias: null });
const ia = crearIA(estado, { gemini: process.env.GEMINI_KEY || process.env.GEMINI_API_KEY, groq: process.env.GROQ_KEY || process.env.GROQ_API_KEY });
if (SIM) usarMock(p => ({ text: JSON.stringify(simulacion(p)), fuentes: [] }));

// ---------- dólar y calculadora de RADAR ----------
let dolar = 1450, dolarMEP = null;
if (!SIM) { try { const r = await fetch('https://dolarapi.com/v1/dolares'); const j = await r.json(); dolar = j.find(x => x.casa === 'oficial')?.venta || dolar; dolarMEP = j.find(x => x.casa === 'bolsa')?.venta || null } catch { } }
usarConfig({ ...cfgRadar, dolar_oficial: dolar });

// ---------- 1. Buscar ofertas por categoría (rotando) ----------
const cats = cfg.categorias || [];
const n = Math.min(cfg.categoriasPorVuelta || 5, cats.length);
const inicio = (estado.vuelta * n) % Math.max(1, cats.length);
const elegidas = Array.from({ length: n }, (_, i) => cats[(inicio + i) % cats.length]);
estado.vuelta++;
console.log(`RADAR Ofertas · ${ahora} · ${SIM ? 'SIMULACIÓN' : 'real'} · categorías: ${elegidas.join(', ')}`);

const ESQ = `{"ofertas":[{"nombre":"producto específico","marca","modelo","categoria","tienda":"nombre del comercio","plataforma":"sitio web","url":"LINK EXACTO de la publicación","imagen_url":"URL directa de la foto o vacío",
"precio":número,"precio_anterior":número o null,"moneda":"ARS o USD","envio":número (0 si es gratis, null si no se sabe),"ubicacion":"ciudad/provincia o país","disponibilidad":"en stock / pocas unidades / sin dato",
"tipo_oferta":"descuento | liquidación | tiempo limitado | mayorista | diferencia entre vendedores","vence":"fecha o vacío",
"precio_mercado_ars":número (precio habitual del MISMO producto nuevo en Mercado Libre Argentina),"precio_venta_sugerido_ars":número (precio realista para revenderlo en Mercado Libre),
"peso_kg":número,"vendedores_ml":número o null,"demanda":"alta | media | baja","evidencia_demanda":"texto tal cual figura, ej. '+5mil vendidos'; vacío si no hay","ventas_mes_estimadas":número,
"competencia":"alta | media | baja","riesgos":["..."],"comprobado":{"precio":true/false,"demanda":true/false}}]}`;

const errores = [], fuentes = [];
const nuevas = [];
for (const cat of elegidas) {
  try {
    const { datos, fuentes: fs1 } = await ia.json(`Buscá en internet ofertas REALES y VIGENTES HOY (${new Date().toLocaleDateString('es-AR')}) en la categoría "${cat}" que se puedan comprar para REVENDER con ganancia en Argentina.
Revisá: ${(cfg.sitios || []).join(', ')}.
Buscá: descuentos importantes, precios por debajo del promedio del mercado, liquidaciones, ofertas por tiempo limitado, diferencias grandes de precio entre vendedores, precios mayoristas y productos con buena demanda y poca competencia.
Reglas: solo tiendas y proveedores donde registrarse es gratis (nada que requiera suscripción paga). Incluí SOLO publicaciones que encontraste con su LINK EXACTO; no inventes precios, ventas ni proveedores. Si un dato no figura, dejalo vacío o null y marcá "comprobado" en false. Desconfiá de descuentos sobre precios inflados: informá el precio habitual de mercado.
Devolvé SOLO JSON, máximo ${cfg.ofertasPorCategoria || 8} ofertas: ${ESQ}`, true);
    const lista = Array.isArray(datos) ? datos : (datos?.ofertas || Object.values(datos || {}).find(Array.isArray) || []);
    (fs1 || []).forEach(f => fuentes.push(f));
    for (const o of lista) if (o && segura(o.url) && num(o.precio) > 0) nuevas.push({ ...o, categoria: o.categoria || cat });
    console.log(`  · ${cat}: ${lista.length} encontradas`);
  } catch (e) { errores.push(`${cat}: ${e.message}`); console.warn(`  · ${cat}: ${e.message}`) }
}

// ---------- 2. Investigación de mercado (una vez por día) ----------
let tendencias = previas.tendencias;
if (!tendencias || tendencias.fecha !== hoy) {
  try {
    const { datos, fuentes: fs2 } = await ia.json(`Investigá en internet qué están comprando hoy los consumidores en Argentina (${new Date().toLocaleDateString('es-AR')}): más vendidos de Mercado Libre por categoría, productos que crecen en búsquedas (Google Trends), estacionalidad del mes y categorías con más demanda y menos competencia.
No inventes cantidades de ventas: si la plataforma no las muestra, indicá "sin dato".
SOLO JSON: {"resumen":"2-3 oraciones","productos":[{"producto","categoria","tendencia":"creciendo | estable | bajando","evidencia":"dato comprobado con su fuente o 'estimación'","competencia":"alta | media | baja","precio_promedio_ars":número o null,"estacionalidad":"texto","url":"fuente"}],"categorias_calientes":["..."]} (máximo 20 productos).`, true);
    tendencias = { fecha: hoy, ...(datos || {}), fuentes: (fs2 || []).slice(0, 10) };
  } catch (e) { errores.push('tendencias: ' + e.message) }
}

// ---------- 2b. Ranking semanal de lo más buscado para comprar en Argentina ----------
// Se arma una vez por semana (se reintenta si falló) con Tendencias de Mercado Libre, Google Trends y los más vendidos.
const semanaISO = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dia = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dia); const ini = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return `${t.getUTCFullYear()}-S${String(Math.ceil(((t - ini) / 864e5 + 1) / 7)).padStart(2, '0')}` };
const MB_ARCH = path.join(SAL, 'mas-buscados.json');
const masBuscados = leer(MB_ARCH, { semanas: [] });
const semana = semanaISO(new Date());
const actual = masBuscados.semanas.find(x => x.semana === semana);
if (!actual || (actual.ranking || []).length < 10 || process.env.FORZAR_SEMANAL === '1') {
  let textoML = '';
  if (!SIM) {
    try {
      const r = await fetch('https://tendencias.mercadolibre.com.ar/', { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'es-AR' }, signal: AbortSignal.timeout(20000) });
      if (r.ok) textoML = (await r.text()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, '\n').replace(/&[a-z#0-9]+;/g, ' ').split('\n').map(x => x.trim()).filter(x => x.length > 2 && x.length < 60).slice(0, 400).join(' | ').slice(0, 7000);
    } catch { }
  }
  try {
    const { datos, fuentes: fs3 } = await ia.json(`Armá el ranking de lo que MÁS BUSCA COMPRAR la gente en Argentina esta semana (${new Date().toLocaleDateString('es-AR')}).
Fuentes prioritarias: Tendencias de Mercado Libre (tendencias.mercadolibre.com.ar: búsquedas más populares y que más crecieron), Google Trends Argentina (búsquedas de compras), más vendidos de Mercado Libre y de las principales tiendas.
${textoML ? 'Texto leído HOY directamente de Tendencias de Mercado Libre (usalo como fuente principal):\n' + textoML + '\n' : ''}
Reglas: productos concretos que la gente quiere comprar (no marcas sueltas ni noticias). No inventes datos: en "evidencia" poné el dato tal cual lo viste y su fuente; si no hay cifra, escribí "posición en el ranking de la fuente".
SOLO JSON: {"resumen":"2 oraciones sobre qué está buscando la gente y por qué","ranking":[{"puesto":1,"producto":"","categoria":"","tendencia":"creciendo | estable | bajando","evidencia":"","fuente":"Mercado Libre Tendencias | Google Trends | Más vendidos ML | otra","url":"","precio_promedio_ars":número o null,"oportunidad_reventa":"alta | media | baja","por_que":"una oración"}]} con 20 productos ordenados del más buscado al menos buscado.`, true);
    const lista = (datos?.ranking || []).filter(x => x?.producto).slice(0, 20).map((x, i) => ({ ...x, puesto: i + 1 }));
    if (lista.length) {
      const anterior = masBuscados.semanas.filter(x => x.semana < semana).sort((a, b) => b.semana.localeCompare(a.semana))[0];
      for (const x of lista) {
        const prev = anterior?.ranking?.find(y => slug(y.producto) === slug(x.producto));
        x.movimiento = !anterior ? null : prev ? prev.puesto - x.puesto : 'nuevo';
      }
      const reg = { semana, fecha: ahora, resumen: datos?.resumen || '', ranking: lista, leyoTendenciasML: !!textoML, fuentes: (fs3 || []).slice(0, 10) };
      masBuscados.semanas = [reg, ...masBuscados.semanas.filter(x => x.semana !== semana)].sort((a, b) => b.semana.localeCompare(a.semana)).slice(0, 26);
      fs.writeFileSync(MB_ARCH, JSON.stringify(masBuscados));
      console.log(`  · Ranking semanal ${semana}: ${lista.length} productos${textoML ? ' (con Tendencias de Mercado Libre)' : ''}`);
    }
  } catch (e) { errores.push('ranking semanal: ' + e.message) }
}

// ---------- 2c. Productos ganadores (5 criterios) ----------
// 1) resuelve un problema real · 2) difícil de encontrar en supermercados o tiendas físicas
// 3) se puede vender al menos 3 veces su costo · 4) ya se está vendiendo · 5) cuesta entre US$5 y US$30, es chico y fácil de enviar
const GN = cfg.ganadores || {};
const PROV = GN.proveedores || ['AliExpress', 'CJ Dropshipping', 'Alibaba', 'Temu', 'DHgate', 'Mercado Libre'];
const PROV_RE = new RegExp(PROV.map(x => x.split(' ')[0]).join('|'), 'i');
const nichos = GN.nichos || ['Salud', 'Belleza', 'Cuidado personal'];
const nN = Math.min(GN.nichosPorVuelta || 2, nichos.length);
const iniN = ((estado.vueltaGanadores || 0) * nN) % nichos.length;
estado.vueltaGanadores = (estado.vueltaGanadores || 0) + 1;
const nichosHoy = Array.from({ length: nN }, (_, i) => nichos[(iniN + i) % nichos.length]);
const poolPrevio = leer(path.join(SAL, 'ofertas.json'), {}).ganadores || [];
const candidatos = [];
for (const nicho of nichosHoy) {
  try {
    const { datos } = await ia.json(`Buscá en internet PRODUCTOS GANADORES para vender en Argentina (dropshipping o importación chica) en el nicho "${nicho}".
Usá SOLO tiendas y proveedores con registro GRATUITO y sin suscripción paga: ${PROV.join(', ')}. No uses AutoDS, Spocket, Zendrop ni otras plataformas pagas. Revisá esos catálogos, lo que se está anunciando en TikTok e Instagram y lo que ya se vende en Mercado Libre Argentina.
Cada producto debe cumplir estos 5 criterios: 1) soluciona un problema real; 2) no se consigue en un supermercado ni en una tienda física común; 3) tiene valor percibido alto: se puede vender al menos 3 veces su costo; 4) ya está generando ventas (pedidos visibles, anuncios activos o ventas en Mercado Libre); 5) cuesta entre 5 y 30 dólares en el proveedor y es chico, liviano y fácil de enviar.
Reglas: datos reales con LINK EXACTO del proveedor; no inventes cifras de ventas: copiá la evidencia tal cual figura o dejala vacía.
SOLO JSON, hasta ${GN.productosPorNicho || 12} productos: {"productos":[{"nombre","nicho","problema":"qué problema resuelve","proveedor":"AliExpress | CJ | Alibaba | Temu | otro","url_proveedor","imagen_url","costo_usd":número,"envio_usd":número o null,"dias_envio":"ej. 10-20","peso_kg":número,"tamano":"chico | mediano | grande",
"en_tiendas_fisicas":"no | a veces | sí","url_ml":"publicación similar en Mercado Libre Argentina o vacío","precio_venta_ars":número (precio al que se vende o se podría vender en Argentina),"vendedores_ml":número o null,
"evidencia_ventas":"ej. '+10.000 vendidos en AliExpress' o 'anuncios activos en TikTok'","ventas_comprobadas":true/false,"anuncios":"plataformas donde se anuncia o vacío","riesgos":["..."]}]}`, true);
    for (const x of (datos?.productos || Object.values(datos || {}).find(Array.isArray) || [])) if (x?.nombre && num(x.costo_usd) > 0 && PROV_RE.test(`${x.proveedor} ${x.url_proveedor}`)) candidatos.push({ ...x, nicho: x.nicho || nicho });
  } catch (e) { errores.push(`ganadores ${nicho}: ${e.message}`) }
}
function evaluarGanador(x) {
  const costoUSD = num(x.costo_usd) + (num(x.envio_usd) || 0), peso = num(x.peso_kg) || 0.3, pv = num(x.precio_venta_ars);
  let r = null; try { if (pv) r = rentab(pv, { metodo: 'courier_economico', costo_usd: costoUSD, peso, cantidad: GN.loteImportacion || 10 }) } catch { }
  const costoARS = r?.cp?.unit ?? costoUSD * (dolarMEP || dolar);
  const mult = pv && costoUSD ? pv / (costoUSD * (dolarMEP || dolar)) : null;
  const c = {
    problema: x.problema && x.problema.length > 12 ? 20 : x.problema ? 10 : 0,
    dificil: { no: 20, 'a veces': 10 }[String(x.en_tiendas_fisicas || '').toLowerCase()] ?? 5,
    x3: mult == null ? 0 : mult >= 3 ? 20 : mult >= 2 ? 10 : 0,
    vendiendo: x.ventas_comprobadas && x.evidencia_ventas ? 20 : x.evidencia_ventas || x.anuncios ? 10 : 0,
    precio: (num(x.costo_usd) >= 5 && num(x.costo_usd) <= 30 ? 12 : 4) + (peso <= 1 && !/grande/i.test(x.tamano || '') ? 8 : 0),
  };
  let nota = Object.values(c).reduce((a, b) => a + b, 0);
  const riesgos = [...(x.riesgos || [])];
  // la nota final exige ganancia real después de importar y vender
  if (r && r.ganancia <= 0) { nota = Math.min(nota, 49); riesgos.push('Con los costos actuales de importación y venta no deja ganancia: habría que comprar por mayor o venderlo más caro.') }
  if (!x.ventas_comprobadas) riesgos.push('Ventas no comprobadas.');
  if (num(x.vendedores_ml) > 40) riesgos.push(`Ya hay ${x.vendedores_ml} vendedores en Mercado Libre.`);
  riesgos.push(`Importación: ${x.dias_envio || '15-35'} días de envío, límites del courier y riesgo de cambio.`);
  const lote = GN.loteImportacion || 10;
  return {
    id: slug(x.nombre + '-' + (x.proveedor || '')), encontrado: ahora, nombre: x.nombre, nicho: x.nicho, problema: x.problema || '', imagen: segura(x.imagen_url),
    proveedor: x.proveedor || '', url: segura(x.url_proveedor), urlML: segura(x.url_ml), costoUSD: +costoUSD.toFixed(2), diasEnvio: x.dias_envio || '', pesoKg: peso, tamano: x.tamano || '', enTiendas: x.en_tiendas_fisicas || 'sin dato',
    precioVenta: pv || null, multiplicador: mult ? +mult.toFixed(1) : null, costoPuesto: Math.round(costoARS), gananciaUnidad: r ? Math.round(r.ganancia) : null, margenPct: r ? +r.margen_neto.toFixed(1) : null,
    lote, inversion: Math.round(costoARS * lote), gananciaLote: r ? Math.round(r.ganancia * lote) : null, vendedoresML: num(x.vendedores_ml) || null,
    evidencia: x.evidencia_ventas || '', anuncios: x.anuncios || '', comprobado: !!x.ventas_comprobadas, criterios: c, nota, riesgos: [...new Set(riesgos)],
  };
}
const limiteG = new Date(Date.now() - (GN.diasVigencia || 30) * 864e5).toISOString();
const mapaG = new Map(poolPrevio.filter(g => g.encontrado >= limiteG).map(g => [g.id, g]));
for (const g of candidatos.map(evaluarGanador)) mapaG.set(g.id, g);
const ganadores = [...mapaG.values()].sort((a, b) => b.nota - a.nota || (b.gananciaLote ?? 0) - (a.gananciaLote ?? 0)).slice(0, GN.maximo || 200);
console.log(`  · Productos ganadores: ${candidatos.length} nuevos (${nichosHoy.join(', ')}) · total ${ganadores.length}`);

// ---------- 3. Analizar cada oferta ----------
const C = cfg.clasificacion || { excelenteROI: 60, buenaROI: 35, moderadaROI: 20 };
function analizar(o) {
  const moneda = String(o.moneda || 'ARS').toUpperCase();
  const precio = num(o.precio), envio = o.envio == null ? null : num(o.envio);
  const internacional = moneda === 'USD';
  const costoUnitARS = internacional ? null : precio + (envio || 0);
  const peso = num(o.peso_kg) || 0.5;
  const pv = num(o.precio_venta_sugerido_ars) || num(o.precio_mercado_ars);
  const key = slug(`${o.nombre}-${o.tienda || o.plataforma}`);

  // historial de precios para detectar descuentos falsos
  const h = (historial[key] ||= []);
  const previosPrecios = h.filter(x => x.fecha < hoy).map(x => x.precio);
  if (!h.find(x => x.fecha === hoy)) h.push({ fecha: hoy, precio }); else h.find(x => x.fecha === hoy).precio = precio;
  historial[key] = h.slice(-90);
  const minAnterior = previosPrecios.length ? Math.min(...previosPrecios) : null;
  const mercado = num(o.precio_mercado_ars);
  const precioARS = internacional ? precio * (dolarMEP || dolar) : precio;
  const descPublicado = num(o.precio_anterior) > precio ? (1 - precio / num(o.precio_anterior)) * 100 : null;
  const descVsMercado = mercado ? (1 - precioARS / mercado) * 100 : null;
  let verificacion = 'sin historial suficiente';
  if (minAnterior != null && minAnterior <= precio * 1.01) verificacion = 'dudoso: el precio ya estuvo igual o más bajo antes';
  else if (descVsMercado != null && descVsMercado < 3) verificacion = 'dudoso: no es más barato que el precio habitual de mercado';
  else if (descVsMercado != null && descVsMercado >= 3) verificacion = `real: ${descVsMercado.toFixed(0)} % por debajo del precio de mercado`;

  // reventa con la calculadora de RADAR (Mercado Libre y web propia)
  let ml = null, web = null;
  const e = internacional ? { metodo: 'courier_economico', costo_usd: precio, peso, cantidad: 10 } : { metodo: 'local', costo_local: costoUnitARS, nombre_local: o.tienda, peso, cantidad: 1 };
  if (pv) { try { ml = rentab(pv, e); web = rentabWeb(num(o.precio_venta_sugerido_ars) || pv, e) } catch { } }
  const costoTotal = ml?.cp?.unit ?? costoUnitARS;
  // canal más conveniente: Mercado Libre o la web propia
  const usaWeb = web && ml && web.ganancia > ml.ganancia;
  const canal = ml ? (usaWeb ? 'Tu web' : 'Mercado Libre') : null;
  const ganancia = ml ? (usaWeb ? web.ganancia : ml.ganancia) : null;
  const roi = ganancia != null && costoTotal ? ganancia / costoTotal * 100 : null;

  // cuánto invertir: lo que se puede vender en ~1 mes, con tope de capital por producto
  const ventasMes = Math.max(1, Math.round(num(o.ventas_mes_estimadas) || ({ alta: 20, media: 8, baja: 3 }[o.demanda] ?? 5)));
  const tope = Math.max(1, Math.floor((cfg.capitalMaximoPorProducto || 300000) / Math.max(1, costoTotal || 1)));
  const unidades = Math.max(1, Math.min(ventasMes, tope, /pocas/i.test(o.disponibilidad || '') ? 3 : 999));

  // riesgos
  const riesgos = [...(o.riesgos || [])].filter(Boolean);
  if (/dudoso/.test(verificacion)) riesgos.push('El descuento podría no ser real.');
  if (!o.comprobado?.demanda) riesgos.push('La demanda es una estimación: no hay ventas comprobadas.');
  if (o.competencia === 'alta' || num(o.vendedores_ml) > 50) riesgos.push('Mucha competencia en Mercado Libre: puede costar vender al precio sugerido.');
  if (envio == null) riesgos.push('No figura el costo de envío de la compra.');
  if (internacional) riesgos.push('Compra en el exterior: demoras de 15 a 35 días, límites del courier y riesgo de cambio.');
  if (/tiempo limitado/i.test(o.tipo_oferta || '')) riesgos.push('Oferta por tiempo limitado: el precio puede cambiar pronto.');

  // clasificación
  const dem = { alta: 3, media: 2, baja: 1 }[o.demanda] || 1, comp = { alta: 3, media: 2, baja: 1 }[o.competencia] || 2;
  let clase = 'No recomendable';
  if (roi != null && roi > 0) {
    if (roi >= C.excelenteROI && dem >= 2 && comp <= 2 && !/dudoso/.test(verificacion)) clase = 'Excelente oportunidad';
    else if (roi >= C.buenaROI && dem >= 2) clase = 'Buena oportunidad';
    else if (roi >= C.moderadaROI) clase = 'Oportunidad moderada';
    else clase = 'Baja rentabilidad';
  }
  if (dem === 1 && comp === 3 && clase !== 'No recomendable') clase = 'Baja rentabilidad';
  const puntaje = roi == null ? 0 : Math.round(Math.min(roi, 150) * 0.45 + dem * 12 + (4 - comp) * 6 + (/real/.test(verificacion) ? 10 : 0) + (o.comprobado?.demanda ? 8 : 0) + (o.comprobado?.precio ? 4 : 0));

  return {
    id: key, encontrada: ahora, nombre: o.nombre, marca: o.marca || '', modelo: o.modelo || '', categoria: o.categoria, imagen: segura(o.imagen_url),
    // qué y dónde
    tienda: o.tienda || o.plataforma || '', plataforma: o.plataforma || '', url: segura(o.url), ubicacion: o.ubicacion || '', disponibilidad: o.disponibilidad || 'sin dato', tipoOferta: o.tipo_oferta || '', vence: o.vence || '',
    // a qué precio
    moneda, precio, precioAnterior: num(o.precio_anterior) || null, envio, descuentoPublicadoPct: descPublicado && +descPublicado.toFixed(1),
    precioMercado: mercado || null, descuentoVsMercadoPct: descVsMercado != null ? +descVsMercado.toFixed(1) : null, verificacion, historial: historial[key].slice(-30),
    // a cuánto vender y cuánto se gana
    precioVenta: pv || null, costoTotalUnidad: costoTotal ? Math.round(costoTotal) : null,
    canal, gastosVentaUnidad: ml?.cv ? Math.round(usaWeb ? web.cv.total : ml.cv.total) : null, gananciaUnidad: ganancia != null ? Math.round(ganancia) : null, roiPct: roi != null ? +roi.toFixed(1) : null,
    margenPct: ml ? +(usaWeb ? web.margen_precio : ml.margen_neto).toFixed(1) : null, ml: ml ? { precio: ml.precio, ganancia: Math.round(ml.ganancia), margenPct: +ml.margen_neto.toFixed(1) } : null, precioMinimoVenta: ml?.equilibrio ? Math.round(ml.equilibrio) : null,
    web: web ? { precio: web.precio, ganancia: Math.round(web.ganancia), margenPct: +web.margen_precio.toFixed(1) } : null,
    // cuánto invertir
    unidadesSugeridas: unidades, inversion: costoTotal ? Math.round(costoTotal * unidades) : null, gananciaLote: ganancia != null ? Math.round(ganancia * unidades) : null,
    diasRecupero: ventasMes ? Math.ceil(30 * unidades / ventasMes) : null,
    // demanda, competencia y riesgos
    demanda: o.demanda || 'sin dato', evidenciaDemanda: o.evidencia_demanda || '', ventasMesEstimadas: ventasMes, competencia: o.competencia || 'sin dato', vendedoresML: num(o.vendedores_ml) || null,
    comprobado: { precio: !!o.comprobado?.precio, demanda: !!o.comprobado?.demanda }, riesgos: [...new Set(riesgos)],
    clasificacion: clase, puntaje,
  };
}

const analizadas = nuevas.map(analizar);
// unir con las ofertas vigentes de vueltas anteriores (las nuevas reemplazan a las repetidas)
const limite = new Date(Date.now() - (cfg.diasVigenciaOferta || 3) * 864e5).toISOString();
const mapa = new Map((previas.ofertas || []).filter(o => o.encontrada >= limite).map(o => [o.id, o]));
for (const o of analizadas) mapa.set(o.id, o);
const ofertas = [...mapa.values()].sort((a, b) => b.puntaje - a.puntaje);
const ranking = ofertas.filter(o => /Excelente|Buena|moderada/.test(o.clasificacion) && o.gananciaUnidad > 0).slice(0, 20).map(o => o.id);

// limpiar historial viejo (más de 120 días sin verse)
const corte = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
for (const k of Object.keys(historial)) if ((historial[k].at(-1)?.fecha || '') < corte) delete historial[k];

const salida = {
  generado: ahora, simulacion: SIM, dolarOficial: dolar, dolarMEP, categoriasRevisadas: elegidas, proximas: Array.from({ length: n }, (_, i) => cats[(inicio + n + i) % cats.length]),
  resumen: { total: ofertas.length, nuevasEstaVuelta: analizadas.length, porClase: ofertas.reduce((m, o) => (m[o.clasificacion] = (m[o.clasificacion] || 0) + 1, m), {}) },
  ranking, ofertas, tendencias, ganadores, nichosHoy, proximosNichos: Array.from({ length: nN }, (_, i) => nichos[(iniN + nN + i) % nichos.length]), fuentes: fuentes.slice(0, 30), errores,
};
fs.writeFileSync(path.join(SAL, 'ofertas.json'), JSON.stringify(salida));
fs.writeFileSync(path.join(SAL, 'historial-precios.json'), JSON.stringify(historial));
fs.writeFileSync(path.join(SAL, 'estado.json'), JSON.stringify(estado));
console.log(`  · Ofertas vigentes: ${ofertas.length} (nuevas ${analizadas.length}) · ranking: ${ranking.length} · errores: ${errores.length}`);

// ---------- datos de prueba ----------
function simulacion(prompt) {
  if (/PRODUCTOS GANADORES/.test(prompt)) return { productos: [['Masajeador cervical eléctrico', 12, 'no', 45000, true], ['Removedor de callos recargable', 8, 'no', 28000, true], ['Cepillo alisador iónico', 15, 'a veces', 39000, false], ['Corrector de postura', 6, 'a veces', 15000, true]].map(([n, c, t, pv, ok]) => ({ nombre: n, problema: 'Alivia dolores y molestias del día a día.', proveedor: 'AliExpress', url_proveedor: 'https://example.com', costo_usd: c, envio_usd: 2, dias_envio: '12-25', peso_kg: 0.3, tamano: 'chico', en_tiendas_fisicas: t, url_ml: '', precio_venta_ars: pv, vendedores_ml: 15, evidencia_ventas: ok ? '+5.000 vendidos' : '', ventas_comprobadas: ok, anuncios: 'TikTok', riesgos: [] })) };
  if (/MÁS BUSCA COMPRAR/.test(prompt)) return { resumen: 'Ranking simulado.', ranking: ['Aire acondicionado split', 'Ventilador de pie', 'Protector solar', 'Zapatillas running', 'Celular gama media', 'Pileta de lona', 'Conservadora', 'Smart TV 50', 'Freidora de aire', 'Auriculares bluetooth', 'Notebook', 'Repelente', 'Bicicleta', 'Parlante bluetooth', 'Smartwatch'].map((p, i) => ({ producto: p, categoria: 'Varios', tendencia: i % 3 ? 'estable' : 'creciendo', evidencia: 'posición en el ranking de la fuente', fuente: 'Mercado Libre Tendencias', url: 'https://tendencias.mercadolibre.com.ar/', precio_promedio_ars: 50000 + i * 10000, oportunidad_reventa: ['alta', 'media', 'baja'][i % 3], por_que: 'Llegada del verano.' })) };
  if (/consumidores/.test(prompt)) return { resumen: 'Tendencias simuladas.', productos: [{ producto: 'Auriculares inalámbricos', categoria: 'Electrónica', tendencia: 'creciendo', evidencia: 'estimación', competencia: 'alta', precio_promedio_ars: 35000, estacionalidad: 'Navidad', url: 'https://example.com' }], categorias_calientes: ['Electrónica'] };
  const cat = (prompt.match(/categoría "([^"]+)"/) || [])[1] || 'Varios';
  const base = [
    ['Auriculares inalámbricos TWS', 20000, 28000, 35000, 'alta', 'alta'], ['Taladro percutor 13mm 650W', 42000, 60000, 78000, 'media', 'media'],
    ['Perfume importado 100ml', 55000, 70000, 98000, 'alta', 'media'], ['Smartwatch deportivo', 18000, 0, 22000, 'baja', 'alta'],
  ];
  return { ofertas: base.map(([nom, p, ant, venta, dem, comp], i) => ({ nombre: `${nom} (${cat})`, marca: 'Genérica', modelo: 'X' + i, tienda: ['Mercado Libre', 'Frávega', 'Easy', 'Megatone'][i], plataforma: 'web', url: 'https://example.com/' + i,
    precio: p, precio_anterior: ant || null, moneda: 'ARS', envio: i === 2 ? null : 0, ubicacion: 'CABA', disponibilidad: 'en stock', tipo_oferta: 'descuento', precio_mercado_ars: Math.round(p * 1.3), precio_venta_sugerido_ars: venta,
    peso_kg: 0.4, vendedores_ml: 30, demanda: dem, evidencia_demanda: dem === 'alta' ? '+5mil vendidos' : '', ventas_mes_estimadas: 10, competencia: comp, riesgos: [], comprobado: { precio: true, demanda: dem === 'alta' } })) };
}
