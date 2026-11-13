#!/usr/bin/env node
// RADAR · Inversiones — Motor principal
// Corre en la nube (GitHub Actions) cada 30 minutos, las 24 horas.
// 1) Trae cotizaciones, tasas, velas y noticias.  2) Calcula indicadores, rulos y rendimientos.
// 3) Consulta al consejo de IAs gratuitas.  4) Evalúa aciertos pasados y aprende.
// 5) Escribe docs/inversiones-datos/inversiones.json para el panel.
// No envía mensajes de WhatsApp: los avisos siguen exactamente con la configuración actual de RADAR.
//
// Uso:  node inversiones/motor.mjs            (datos reales)
//       SIMULAR=1 node inversiones/motor.mjs  (datos de prueba, sin internet)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as F from './fuentes.mjs';
import { leerSenales } from './indicadores.mjs';
import { consultarTodas, extraerJSON, proveedoresActivos, PROVEEDORES } from './ia.mjs';
import * as A from './aprendizaje.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Los resultados van dentro de docs/ porque GitHub Pages publica esa carpeta (igual que el resto de RADAR)
const DATOS = path.join(RAIZ, 'docs', 'inversiones-datos');
const SIM = process.env.SIMULAR === '1';
const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'inversiones', 'config.json'), 'utf8'));
fs.mkdirSync(DATOS, { recursive: true });

const leer = (f, def) => { try { return JSON.parse(fs.readFileSync(path.join(DATOS, f), 'utf8')); } catch { return def; } };
const guardar = (f, d) => fs.writeFileSync(path.join(DATOS, f), JSON.stringify(d, null, 1));
const pct = x => x == null ? null : Math.round(x * 10000) / 100; // 0.0123 → 1.23

const ahora = new Date().toISOString();
console.log(`RADAR Inversiones · ${ahora} · ${SIM ? 'MODO SIMULACIÓN' : 'datos reales'}`);

// ---------- 1. Datos ----------
const dolar = SIM ? F.dolarSimulado() : await F.cotizacionesDolar();
const ar = SIM ? F.argentinaSimulada() : await F.datosArgentina();
const velasPorActivo = {};
for (const [i, a] of cfg.activos.entries()) {
  velasPorActivo[a.yahoo] = SIM ? F.velasSimuladas(i + 1, 420, 50 + i * 30) : await F.velasYahoo(a.yahoo);
}
let titulares = [];
if (!SIM) {
  for (const q of cfg.busquedasNoticias) titulares.push(...(await F.noticias(q, 5)).map(n => ({ ...n, tema: q })));
  const vistos = new Set();
  titulares = titulares.filter(n => !vistos.has(n.titulo) && vistos.add(n.titulo));
} else {
  titulares = [{ titulo: 'Titular de prueba: el mercado opera con cautela', fuente: 'Simulación', tema: 'prueba', enlace: '#' }];
}

// ---------- 2. Aprendizaje: evaluar lo recomendado antes ----------
let historial = leer('historial.json', []);
const estado = leer('aprendizaje.json', {});
const evaluadas = A.evaluar(historial, velasPorActivo, cfg.horizonteEvaluacionDias, estado);
const W = A.pesos(estado);
console.log(`  · Evaluaciones nuevas: ${evaluadas}`);

// ---------- 3. Análisis técnico por activo ----------
const activos = [];
for (const a of cfg.activos) {
  const velas = velasPorActivo[a.yahoo];
  if (!velas || velas.length < 60) { activos.push({ ...a, error: 'sin datos suficientes' }); continue; }
  const s = leerSenales(velas);
  // ajustar el puntaje con lo aprendido: cada señal pesa según su historial de aciertos
  const puntajeAjustado = Math.max(-100, Math.min(100, Math.round(
    s.senales.reduce((t, x) => t + x.peso * (W.senales[x.clave] ?? 1), 0))));
  const accion = puntajeAjustado >= 30 ? 'COMPRAR' : puntajeAjustado <= -30 ? 'VENDER' : 'ESPERAR';
  const c = velas.map(v => v.close);
  const var30 = c.length > 22 ? c.at(-1) / c.at(-22) - 1 : null;
  const var1 = c.at(-1) / c.at(-2) - 1;
  const cola = velas.slice(-300);
  const desde = velas.length - cola.length;
  const corte = arr => arr.slice(desde).map((v, i) => v == null ? null : { time: cola[i].time, value: +v.toFixed(4) }).filter(Boolean);
  activos.push({
    ...a, precio: s.precio, variacionDia: pct(var1), variacion30d: pct(var30),
    puntaje: puntajeAjustado, puntajeBase: s.puntaje, accion,
    m20: s.m20, m50: s.m50, m200: s.m200, rsi: s.rsi, fibonacci: s.fibonacci, senales: s.senales,
    grafico: { velas: cola, m20: corte(s.series.m20), m50: corte(s.series.m50), m200: corte(s.series.m200), rsi: corte(s.series.rsi) },
  });
}

// ---------- 4. Rulos (arbitraje entre cotizaciones) ----------
const com = cfg.comisionPorOperacion;
const rulos = [];
if (dolar) {
  const R = (nombre, compraEn, vendeEn, precioCompra, precioVenta, ops, nota) => {
    if (!precioCompra || !precioVenta) return;
    const bruto = precioVenta / precioCompra - 1;
    const neto = bruto - ops * com;
    rulos.push({
      nombre, pasos: `Comprar dólares ${compraEn} a $${precioCompra} → vender ${vendeEn} a $${precioVenta}`,
      brutoPct: pct(bruto), netoPct: pct(neto),
      gananciaSobreCapital: Math.round(cfg.capitalReferencia * neto),
      conviene: neto >= cfg.minimoRuloNeto, nota,
    });
  };
  const d = dolar;
  R('MEP → CCL', 'MEP', 'como CCL', d.bolsa?.venta, d.contadoconliqui?.compra, 2, 'Requiere operar bonos (AL30/GD30) en un broker. Verifique los plazos mínimos de tenencia (parking) vigentes de la CNV.');
  R('MEP → Cripto (USDT)', 'MEP', 'como USDT en un exchange', d.bolsa?.venta, d.cripto?.compra, 3, 'Incluye pasar los dólares del broker a un exchange. Revise comisiones de retiro y depósito.');
  R('Cripto (USDT) → MEP', 'en USDT', 'por MEP', d.cripto?.venta, d.bolsa?.compra, 3, 'Camino inverso: comprar USDT con pesos y vender dólares MEP.');
  R('Oficial → MEP', 'oficial en el banco', 'por MEP', d.oficial?.venta, d.bolsa?.compra, 2, 'Solo si la normativa vigente permite comprar oficial y vender MEP sin restricción cruzada. Verifique antes de operar.');
  R('Oficial → Blue', 'oficial en el banco', 'en el mercado informal', d.oficial?.venta, d.blue?.compra, 1, 'Mercado informal: no se recomienda por riesgo legal y de seguridad. Se muestra solo como referencia.');
  rulos.sort((a, b) => b.netoPct - a.netoPct);
}

// ---------- 5. Rendimientos comparados (mensual estimado y real) ----------
const inflMensual = Array.isArray(ar?.inflacion) && ar.inflacion.length ? ar.inflacion.at(-1).valor / 100 : null;
const rend = [];
const real = m => inflMensual == null ? null : (1 + m) / (1 + inflMensual) - 1;
if (Array.isArray(ar?.plazoFijo) && ar.plazoFijo.length) {
  const mejores = ar.plazoFijo.filter(x => x.tnaClientes).sort((a, b) => b.tnaClientes - a.tnaClientes).slice(0, 3);
  for (const b of mejores) {
    const m = b.tnaClientes * 30 / 365;
    rend.push({ nombre: `Plazo fijo ${b.entidad}`, tipo: 'Tasa fija en pesos', riesgo: 'Bajo', mensualPct: pct(m), realPct: pct(real(m)), donde: b.entidad, como: 'Desde el home banking, a 30 días.' });
  }
}
if (Array.isArray(ar?.fciU) && Array.isArray(ar?.fciP)) {
  const prev = Object.fromEntries(ar.fciP.map(f => [f.fondo, f]));
  const fondos = ar.fciU.map(f => {
    const p = prev[f.fondo]; if (!p?.vcp || !f.vcp) return null;
    const dias = Math.max(1, (new Date(f.fecha) - new Date(p.fecha)) / 864e5);
    const m = Math.pow(f.vcp / p.vcp, 30 / dias) - 1;
    return (m > 0 && m < 0.1) ? { fondo: f.fondo, m } : null;
  }).filter(Boolean).sort((a, b) => b.m - a.m).slice(0, 3);
  for (const f of fondos) rend.push({ nombre: `FCI ${f.fondo}`, tipo: 'Money market (liquidez inmediata)', riesgo: 'Bajo', mensualPct: pct(f.m), realPct: pct(real(f.m)), donde: 'Su banco o broker', como: 'Suscribir el fondo; se rescata en el día.' });
}
if (Array.isArray(ar?.cripto)) {
  const st = ar.cripto.flatMap(e => (e.rendimientos || []).filter(r => /USDT|USDC|DAI/.test(r.moneda)).map(r => ({ entidad: e.entidad, ...r }))).sort((a, b) => b.apy - a.apy).slice(0, 2);
  for (const s of st) { const m = Math.pow(1 + s.apy / 100, 1 / 12) - 1; rend.push({ nombre: `${s.moneda} en ${s.entidad}`, tipo: 'Dólar digital con interés', riesgo: 'Medio', mensualPct: pct(m), realPct: null, donde: s.entidad, como: 'Rendimiento en dólares; no se compara con la inflación en pesos.' }); }
}
for (const a of activos.filter(x => x.precio && x.variacion30d != null)) {
  rend.push({ nombre: a.nombre, tipo: `${a.tipo} (variable)`, riesgo: a.tipo === 'cripto' ? 'Alto' : 'Medio/Alto', mensualPct: a.variacion30d, realPct: a.moneda === 'ARS' ? pct(real(a.variacion30d / 100)) : null, donde: a.tipo === 'cripto' ? 'Exchange' : 'Broker (cuenta comitente)', como: `Señal actual: ${a.accion}. El rendimiento mostrado es el de los últimos 30 días, no una garantía.` });
}
// Integración con RADAR de Ventas: si existe el archivo de productos, comparar mercadería con inversiones
const productos = leer('productos.json', null); // opcional: docs/inversiones-datos/productos.json
if (Array.isArray(productos)) {
  for (const p of productos.filter(p => p.margen && p.diasVenta).slice(0, 5)) {
    const m = Math.pow(1 + p.margen, 30 / p.diasVenta) - 1;
    rend.push({ nombre: `Mercadería: ${p.nombre}`, tipo: 'Compra y venta (RADAR)', riesgo: 'Medio', mensualPct: pct(m), realPct: pct(real(m)), donde: p.proveedor || 'Proveedor RADAR', como: `Margen ${pct(p.margen)} % con rotación estimada de ${p.diasVenta} días.` });
  }
}
rend.sort((a, b) => (b.realPct ?? b.mensualPct ?? -999) - (a.realPct ?? a.mensualPct ?? -999));

// ---------- 6. Consejo de IAs ----------
const resumenParaIA = {
  fecha: ahora, inflacionMensualPct: pct(inflMensual), riesgoPais: ar?.riesgo?.valor ?? null,
  dolar: dolar ? Object.fromEntries(Object.entries(dolar).map(([k, v]) => [k, { compra: v.compra, venta: v.venta }])) : null,
  rulos: rulos.map(r => ({ nombre: r.nombre, netoPct: r.netoPct })),
  rendimientos: rend.slice(0, 12).map(r => ({ nombre: r.nombre, mensualPct: r.mensualPct, realPct: r.realPct, riesgo: r.riesgo })),
  activos: activos.filter(a => a.precio).map(a => ({
    nombre: a.nombre, yahoo: a.yahoo, precio: +a.precio.toFixed(2), var30dPct: a.variacion30d, rsi: a.rsi && +a.rsi.toFixed(1),
    m20: a.m20 && +a.m20.toFixed(2), m50: a.m50 && +a.m50.toFixed(2), m200: a.m200 && +a.m200.toFixed(2),
    fibTramo: a.fibonacci?.tendenciaTramo, fibRetroceso: a.fibonacci?.retroceso.map(n => [n.nivel, +n.precio.toFixed(2)]),
    fibExtension: a.fibonacci?.extension.map(n => [n.nivel, +n.precio.toFixed(2)]), puntajeTecnico: a.puntaje,
  })),
  titulares: titulares.slice(0, 30).map(t => t.titulo),
};
const SISTEMA = 'Usted es un analista financiero prudente que trabaja para un inversor argentino. Responda SOLO con un objeto JSON válido, en español formal y sencillo. ' +
  'Base su opinión en los datos recibidos (medias móviles, RSI, Fibonacci, tasas, inflación, brechas del dólar y titulares). No invente datos. ' +
  'Formato: {"resumen":"2-3 oraciones","mejorOpcion":{"nombre":"","porque":""},"activos":[{"nombre":"","yahoo":"","accion":"COMPRAR|VENDER|ESPERAR","confianza":0-100,"entrada":numero,"objetivo":numero,"stop":numero,"razon":"una oración"}],"riesgos":["..."]}';
let opiniones = [];
const votosIA = {};
const activosIA = proveedoresActivos(cfg.ia.proveedores);
if (!SIM && activosIA.length) {
  const resp = await consultarTodas(SISTEMA, [{ role: 'user', content: JSON.stringify(resumenParaIA) }], { json: true, proveedores: cfg.ia.proveedores });
  for (const r of resp) {
    const j = extraerJSON(r.texto);
    if (j?.activos) votosIA[r.proveedor] = j.activos.map(x => ({ ...x, accion: String(x.accion || '').toUpperCase() }));
    opiniones.push({ proveedor: r.proveedor, nombre: r.nombre, modelo: r.modelo, ms: r.ms, error: r.error ?? (j ? null : 'respuesta no legible'), opinion: j, confiabilidad: W.proveedores[r.proveedor] ?? 1 });
  }
} else if (SIM) {
  // opiniones simuladas para probar el panel
  for (const [k, acc] of [['github', 'COMPRAR'], ['gemini', 'ESPERAR'], ['groq', 'COMPRAR']]) {
    votosIA[k] = activos.filter(a => a.precio).map(a => ({ nombre: a.nombre, yahoo: a.yahoo, accion: a.puntaje > 0 ? acc : 'ESPERAR', confianza: 60, razon: 'Opinión simulada.' }));
    opiniones.push({ proveedor: k, nombre: PROVEEDORES[k].nombre, modelo: 'simulado', ms: 0, error: null, confiabilidad: 1,
      opinion: { resumen: 'Opinión de prueba generada en modo simulación.', mejorOpcion: { nombre: 'FCI Money Market A', porque: 'Rendimiento estable y liquidez inmediata.' }, activos: votosIA[k], riesgos: ['Datos simulados.'] } });
  }
}

// ---------- 7. Consenso por activo ----------
for (const a of activos.filter(x => x.precio)) {
  const votos = {};
  for (const [prov, lista] of Object.entries(votosIA)) { const v = lista.find(x => x.yahoo === a.yahoo || x.nombre === a.nombre); if (v) votos[prov] = v.accion; }
  a.consenso = A.consenso(a, votos, W);
  const niveles = Object.values(votosIA).map(l => l.find(x => x.yahoo === a.yahoo || x.nombre === a.nombre)).filter(Boolean);
  const med = k => { const v = niveles.map(x => +x[k]).filter(n => n > 0).sort((p, q) => p - q); return v.length ? v[Math.floor(v.length / 2)] : null; };
  a.niveles = {
    entrada: med('entrada') ?? a.precio,
    objetivo: med('objetivo') ?? a.fibonacci?.extension?.[0]?.precio ?? null,
    stop: med('stop') ?? (a.fibonacci ? a.fibonacci.retroceso.find(n => n.precio < a.precio * 0.97)?.precio : null),
  };
  a.razonesIA = niveles.map(x => x.razon).filter(Boolean).slice(0, 4);
}

// ---------- 8. Guardar ----------
historial = A.registrar(historial, ahora, activos.filter(a => a.precio), votosIA);
guardar('historial.json', historial);
guardar('aprendizaje.json', estado);

const salida = {
  generado: ahora, simulacion: SIM,
  inflacionMensualPct: pct(inflMensual), riesgoPais: ar?.riesgo?.valor ?? null,
  dolar, rulos, rendimientos: rend, activos, opiniones, titulares: titulares.slice(0, 40),
  aprendizaje: {
    registros: historial.length,
    evaluaciones: Object.values(estado.proveedores ?? {}).reduce((t, s) => t + s.total, 0) + (estado.tecnico?.total ?? 0),
    proveedores: Object.fromEntries(Object.entries(estado.proveedores ?? {}).map(([k, s]) => [k, { ...s, confiabilidad: W.proveedores[k] }])),
    tecnico: { ...(estado.tecnico ?? {}), confiabilidad: W.tecnico },
    senales: Object.fromEntries(Object.entries(estado.senales ?? {}).map(([k, s]) => [k, { ...s, confiabilidad: W.senales[k] }])),
  },
  iaActivas: SIM ? ['github', 'gemini', 'groq'] : activosIA,
};
guardar('inversiones.json', salida);
console.log(`  · Activos analizados: ${activos.filter(a => a.precio).length}/${activos.length} · Rulos: ${rulos.length} · Rendimientos: ${rend.length} · IAs: ${opiniones.length}`);
console.log('  · Listo: docs/inversiones-datos/inversiones.json');
