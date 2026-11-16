// RADAR · Inversiones — Fuentes de datos públicas y gratuitas
// dolarapi.com (cotizaciones), argentinadatos.com (tasas, inflación, FCI, riesgo país),
// Yahoo Finance (velas diarias), Google Noticias (titulares). Sin claves.

const UA = { 'User-Agent': 'Mozilla/5.0 (RADAR Inversiones)', 'Accept': 'application/json,text/xml,*/*' };

async function traer(url, tipo = 'json', intentos = 2) {
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return tipo === 'json' ? await r.json() : await r.text();
    } catch (e) {
      if (i === intentos - 1) { console.warn(`  · No se pudo leer ${url}: ${e.message}`); return null; }
      await new Promise(res => setTimeout(res, 1500));
    }
  }
}

export async function cotizacionesDolar() {
  const d = await traer('https://dolarapi.com/v1/dolares');
  if (!Array.isArray(d)) return null;
  const porCasa = {};
  for (const x of d) porCasa[x.casa] = { nombre: x.nombre, compra: x.compra, venta: x.venta, fecha: x.fechaActualizacion };
  return porCasa;
}

export async function datosArgentina() {
  const base = 'https://api.argentinadatos.com/v1/finanzas';
  const [inflacion, riesgo, plazoFijo, fciU, fciP, cripto] = await Promise.all([
    traer(`${base}/indices/inflacion`),
    traer(`${base}/indices/riesgo-pais/ultimo`),
    traer(`${base}/tasas/plazoFijo`),
    traer(`${base}/fci/mercadoDinero/ultimo`),
    traer(`${base}/fci/mercadoDinero/penultimo`),
    traer(`${base}/rendimientos`),
  ]);
  return { inflacion, riesgo, plazoFijo, fciU, fciP, cripto };
}

export async function velasYahoo(simbolo, rango = '2y') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}?range=${rango}&interval=1d`;
  const d = await traer(url);
  const res = d?.chart?.result?.[0];
  if (!res) return null;
  const q = res.indicators.quote[0];
  const velas = [];
  res.timestamp.forEach((t, i) => {
    if (q.close[i] == null || q.open[i] == null) return;
    velas.push({
      time: new Date(t * 1000).toISOString().slice(0, 10),
      open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume[i] ?? 0,
    });
  });
  // quitar fechas repetidas (puede pasar con la vela del día en curso)
  return velas.filter((v, i, a) => i === a.length - 1 || v.time !== a[i + 1].time);
}

export async function noticias(busqueda, max = 6) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(busqueda)}&hl=es-419&gl=AR&ceid=AR:es-419`;
  const xml = await traer(url, 'text');
  if (!xml) return [];
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, max);
  const tag = (s, t) => (s.match(new RegExp(`<${t}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${t}>`)) || [])[1]?.trim() ?? '';
  return items.map(m => ({
    titulo: tag(m[1], 'title').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
    enlace: tag(m[1], 'link'),
    fecha: tag(m[1], 'pubDate'),
    fuente: tag(m[1], 'source'),
  }));
}

// ---------- Modo simulación (para probar sin internet) ----------
export function velasSimuladas(semilla = 1, dias = 400, base = 100) {
  let x = semilla * 9301 + 49297;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const velas = []; let p = base;
  const hoy = new Date();
  for (let i = dias; i > 0; i--) {
    const d = new Date(hoy); d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const tendencia = Math.sin(i / 60) * 0.004;
    const o = p; const c = Math.max(1, o * (1 + tendencia + (rnd() - 0.5) * 0.04));
    velas.push({ time: d.toISOString().slice(0, 10), open: o, high: Math.max(o, c) * (1 + rnd() * 0.01), low: Math.min(o, c) * (1 - rnd() * 0.01), close: c, volume: Math.round(rnd() * 1e6) });
    p = c;
  }
  return velas;
}

export function dolarSimulado() {
  return {
    oficial: { nombre: 'Oficial', compra: 1420, venta: 1470 },
    blue: { nombre: 'Blue', compra: 1430, venta: 1450 },
    bolsa: { nombre: 'Bolsa (MEP)', compra: 1462, venta: 1468 },
    contadoconliqui: { nombre: 'Contado con liquidación', compra: 1488, venta: 1495 },
    cripto: { nombre: 'Cripto', compra: 1475, venta: 1490 },
    mayorista: { nombre: 'Mayorista', compra: 1440, venta: 1449 },
    tarjeta: { nombre: 'Tarjeta', compra: 1846, venta: 1911 },
  };
}

export function argentinaSimulada() {
  return {
    inflacion: [{ fecha: '2026-09-30', valor: 2.1 }, { fecha: '2026-10-31', valor: 2.0 }],
    riesgo: { fecha: '2026-11-12', valor: 640 },
    plazoFijo: [
      { entidad: 'BANCO DE LA NACION ARGENTINA', tnaClientes: 0.29 },
      { entidad: 'BANCO GALICIA', tnaClientes: 0.30 },
      { entidad: 'BANCO PROVINCIA', tnaClientes: 0.31 },
    ],
    fciU: [{ fondo: 'Money Market A', fecha: '2026-11-11', vcp: 100.08 }, { fondo: 'Money Market B', fecha: '2026-11-11', vcp: 50.035 }],
    fciP: [{ fondo: 'Money Market A', fecha: '2026-11-10', vcp: 100.0 }, { fondo: 'Money Market B', fecha: '2026-11-10', vcp: 50.0 }],
    cripto: [{ entidad: 'buenbit', rendimientos: [{ moneda: 'USDT', apy: 5.5 }, { moneda: 'USDC', apy: 5.0 }] }],
  };
}

// ---------- Renta fija argentina en vivo (data912.com, gratuito y público) ----------
// arg_bonds: bonos soberanos · arg_notes: letras (LECAP/BONCAP) · arg_corp: obligaciones negociables
export async function rentaFija() {
  const base = 'https://data912.com/live';
  const [bonos, letras, ons] = await Promise.all(['arg_bonds', 'arg_notes', 'arg_corp'].map(t => traer(`${base}/${t}`)));
  const norm = (lista, tipo) => (Array.isArray(lista) ? lista : []).map(x => ({
    simbolo: x.symbol, tipo,
    precio: x.c ?? x.px_ask ?? x.px_bid ?? null, compra: x.px_bid ?? null, venta: x.px_ask ?? null,
    variacionPct: x.pct_change ?? null, volumen: x.v ?? null, operaciones: x.q_op ?? null,
  })).filter(x => x.simbolo && x.precio > 0);
  return { bonos: norm(bonos, 'Bono'), letras: norm(letras, 'Letra'), ons: norm(ons, 'Obligación negociable') };
}

// ---------- Cotizaciones de USDT en cada exchange argentino (criptoya.com, gratuito y público) ----------
export async function usdtPorExchange() {
  const d = await traer('https://criptoya.com/api/usdt/ars/1');
  if (!d || typeof d !== 'object') return [];
  return Object.entries(d).map(([exchange, v]) => ({ exchange, compra: v.totalAsk ?? v.ask, venta: v.totalBid ?? v.bid, hora: v.time }))
    .filter(x => x.compra > 0 && x.venta > 0);
}

export function rentaFijaSimulada() {
  const b = (s, p, v) => ({ simbolo: s, precio: p, compra: p * 0.998, venta: p * 1.002, variacionPct: v, volumen: 1e8, operaciones: 300 });
  return {
    bonos: [b('AL30', 89500, 0.4), b('AL30D', 61.2, 0.2), b('AL30C', 58.4, 0.1), b('GD30', 91200, 0.3), b('GD35', 72000, -0.2)].map(x => ({ ...x, tipo: 'Bono' })),
    letras: [b('S30E7', 104.2, 0.1), b('T15E7', 112.5, 0.05)].map(x => ({ ...x, tipo: 'Letra' })),
    ons: [b('YMCXO', 1650, 0.3), b('TLC5O', 1580, -0.1)].map(x => ({ ...x, tipo: 'Obligación negociable' })),
  };
}
export function usdtSimulado() {
  return [{ exchange: 'buenbit', compra: 1672, venta: 1655 }, { exchange: 'lemoncash', compra: 1668, venta: 1650 }, { exchange: 'binancep2p', compra: 1660, venta: 1664 }, { exchange: 'ripio', compra: 1680, venta: 1648 }];
}
