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
Reglas: incluí SOLO publicaciones que encontraste con su LINK EXACTO; no inventes precios, ventas ni proveedores. Si un dato no figura, dejalo vacío o null y marcá "comprobado" en false. Desconfiá de descuentos sobre precios inflados: informá el precio habitual de mercado.
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
  ranking, ofertas, tendencias, fuentes: fuentes.slice(0, 30), errores,
};
fs.writeFileSync(path.join(SAL, 'ofertas.json'), JSON.stringify(salida));
fs.writeFileSync(path.join(SAL, 'historial-precios.json'), JSON.stringify(historial));
fs.writeFileSync(path.join(SAL, 'estado.json'), JSON.stringify(estado));
console.log(`  · Ofertas vigentes: ${ofertas.length} (nuevas ${analizadas.length}) · ranking: ${ranking.length} · errores: ${errores.length}`);

// ---------- datos de prueba ----------
function simulacion(prompt) {
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
