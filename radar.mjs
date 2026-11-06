// RADAR en la nube: corre solo cada hora en GitHub (gratis), busca y analiza productos, aprende y se mejora.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { usarConfig, evaluar, rentabWeb, num, ars, pct } from './lib/calc.mjs';
import { crearIA, usarMock } from './lib/ia.mjs';
import { encriptar, desencriptar } from './lib/cripto.mjs';
import { validarEstrategia } from './test/prueba.mjs';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const R = p => path.join(RAIZ, p);
const env = process.env;
const CLAVE = env.RADAR_CLAVE;
const INICIO = Date.now(), LIMITE_MS = (+env.LIMITE_MIN || 30) * 60000;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const esperar = ms => new Promise(r => setTimeout(r, env.MOCK ? 0 : ms));
const ahora = () => new Date().toISOString();
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const hayTiempo = () => Date.now() - INICIO < LIMITE_MS;

if (!CLAVE || CLAVE.length < 6) { console.error('Falta el secreto RADAR_CLAVE (tu contraseña, mínimo 6 caracteres).'); process.exit(1) }
if (!env.GEMINI_KEY && !env.GROQ_KEY && !env.MOCK) { console.error('Falta al menos un secreto: GEMINI_KEY o GROQ_KEY.'); process.exit(1) }

// ------------------------------------------------------------ estado (encriptado)
const ARCH = R('data/estado.enc');
let E = { productos: {}, conocimiento: {}, actividad: [], ultimos: {}, cola_wa: [], ia: {}, vuelta: 0 };
if (fs.existsSync(ARCH)) {
  try { E = { ...E, ...desencriptar(fs.readFileSync(ARCH, 'utf8'), CLAVE) } }
  catch (e) { console.error('No se pudo abrir data/estado.enc: la contraseña RADAR_CLAVE no coincide con la que se usó antes.'); process.exit(1) }
}
const config = JSON.parse(fs.readFileSync(R('config.json'), 'utf8'));
let CFG = usarConfig({ ...config, dolar_oficial: E.dolar || 1450 });
const ia = crearIA(E, { gemini: env.GEMINI_KEY, groq: env.GROQ_KEY });
if (env.MOCK) usarMock((await import(pathToFileURL(R('test/mock.mjs')).href)).respuesta);
let EST = await import(pathToFileURL(R('lib/estrategia.mjs')).href + '?v=' + Date.now());

function registrar(tipo, detalle) { E.actividad.unshift({ tipo, detalle, fecha: ahora() }); E.actividad = E.actividad.slice(0, 80); log(tipo, '-', detalle) }
const horasDesde = k => E.ultimos[k] ? (Date.now() - new Date(E.ultimos[k])) / 36e5 : 1e9;
const marcar = k => { E.ultimos[k] = ahora() };
const cupo = () => ia.usadas() < (config.max_consultas_ia_por_dia || 160) && hayTiempo();
const prods = () => Object.entries(E.productos).map(([k, p]) => ({ id: k, ...p, ev: evaluar(p) }));
const slug = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || id();
const conoc = tipo => Object.values(E.conocimiento).filter(c => c.tipo === tipo).sort((a, b) => a.fecha < b.fecha ? 1 : -1);

// ------------------------------------------------------------ criterios y prompts
const CRITERIOS = () => {
  const ps = prods();
  return `CRITERIOS DEL VENDEDOR (Argentina). Vende en Mercado Libre y en su propia página web.
1) Lo más importante: VENTAS ASEGURADAS. "ventas_comprobadas": true solo con evidencia concreta encontrada hoy ("+X vendidos" en Mercado Libre, ventas en Amazon/AliExpress/Temu, rankings de más vendidos, varios vendedores con ventas). Poné la evidencia con URL exacta en "prueba_de_ventas". Nunca inventes.
2) MERCADO LIBRE (después de comisión, costo fijo, envío, IVA, publicidad, impuestos e importación) tiene que cumplir al menos una: A) precio de venta ≥ ${CFG.margen_minimo_pct}% sobre el precio del proveedor y con ganancia; o B) ganancia limpia ≥ ${CFG.ml_ganancia_min_pct_costo}% del costo del producto puesto en Argentina.
3) PÁGINA WEB propia: ganancia limpia ≥ ${CFG.web.margen_min_pct_precio}% del precio de venta, después de producto, plataforma, pasarela de pago, publicidad, envío e impuestos.
4) Los productos de menos de $30.000 casi nunca cumplen en Mercado Libre: priorizá precio medio o alto, kits, combos y productos livianos con proveedor barato.
5) El capital y la condición fiscal NO importan. Evitá ANMAT/ENACOM y marcas registradas.
6) Compará en TODAS las plataformas: Mercado Libre Argentina, Amazon, AliExpress, Temu, Shein, eBay, Alibaba, 1688, DHgate, Made-in-China, CJ Dropshipping, Global Sources y proveedores/mayoristas LOCALES de Argentina.
Notas del vendedor: ${CFG.perfil.notas || '—'}. Dólar oficial: ${CFG.dolar_oficial}.
Ya analizados (no repetir): ${ps.map(p => p.nombre).slice(-150).join(' | ') || 'ninguno'}
Aprobados hasta ahora: ${ps.filter(p => p.ev.veredicto === 'VENDER').map(p => p.nombre).slice(-30).join(' | ') || '—'}
Reglas aprendidas: ${conoc('regla').slice(0, 20).map(c => c.titulo).join(' | ') || '—'}`;
};
const ESQUEMA = `{"nombre","categoria","descripcion","peso_kg":número,"derecho_importacion_pct":número,
"imagen_url":"URL DIRECTA de la foto del producto (jpg/png/webp, por ejemplo de http2.mlstatic.com o ae01.alicdn.com) tomada de la publicación encontrada; vacío si no la tenés",
"fuente_principal":{"plataforma":"dónde lo encontraste","url":"link EXACTO de la publicación"},
"costo_proveedor_usd":número,"precio_venta_sugerido_ars":número (precio para Mercado Libre),"precio_venta_web_ars":número (precio para la página web propia),
"proveedores":[{"proveedor","plataforma","tipo":"internacional|local","precio_usd":número,"precio_ars":número (solo locales),"moq":número,"url":"link exacto"}],
"precios_mercados":[{"mercado":"Argentina - Mercado Libre","precio":número,"moneda":"ARS","vendidos":"ej. +5mil vendidos","url":"link exacto"},{"mercado":"Amazon","precio","moneda","vendidos","url"},{"mercado":"AliExpress","precio","moneda","vendidos","url"},{"mercado":"Temu","precio","moneda","vendidos","url"}],
"demanda":{"nivel":"alta|media|baja","puntaje":0-100,"ventas_comprobadas":true/false,"unidades_vendidas_aprox":número,"prueba_de_ventas","tendencia","estacionalidad","meses_pico":[],"busquedas":"qué y cuánto busca la gente"},
"competencia":{"nivel","puntaje":0-100,"lider","como_diferenciarse"},"cliente_ideal","quejas_frecuentes":[],"riesgos_regulatorios":["ninguno" o lista],
"por_que_si":[],"por_que_no":[],"como_abaratar":[],"maxima_ganancia":["pasos concretos para ganar lo máximo"],
"alternativas_mejoradas":[{"nombre","mejora":"qué mejora en calidad o precio","proveedor","url","costo_usd":número,"precio_web_sugerido_ars":número}],
"plan_venta":{"titulo_ml","fotos","kit_o_combo","web"},"plan_publicidad":{"mercado_ads","meta_ads","tiktok","google","organico"},
"ventas_estimadas_mes":{"pesimista":número,"esperado":número,"optimista":número},"resumen"}`;

const mesActual = () => new Date().toLocaleDateString('es-AR', { month: 'long', timeZone: 'America/Argentina/Buenos_Aires' });

async function proponer(n, cond) {
  const extra = EST.instruccionesBusqueda({ vuelta: E.vuelta, mes: mesActual(), aprobados: prods().filter(p => p.ev.veredicto === 'VENDER').map(p => p.nombre) });
  const { datos } = await ia.json(`Hacé una búsqueda EXHAUSTIVA y GLOBAL en internet de ${n} productos DISTINTOS para vender en Argentina (Mercado Libre y página web propia) que cumplan estos criterios. Mirá los más vendidos de Mercado Libre por categoría, Amazon Best Sellers y Movers & Shakers, AliExpress y Temu, TikTok Shop, tendencias de Google y lo que la gente busca en esta temporada (hoy es ${new Date().toLocaleDateString('es-AR')}). Incluí productos que venden más de 1000 unidades para los que se pueda conseguir una versión mejor o más barata.
${cond ? 'Pedido del vendedor: ' + cond : extra}
${CRITERIOS()}
Devolvé SOLO un JSON: lista de objetos {"producto":"nombre específico","motivo":"prueba de ventas encontrada"}.`, true);
  const ya = new Set(Object.values(E.productos).map(p => String(p.nombre).toLowerCase()));
  // acepta cualquier forma de lista que devuelva la IA
  let lista = Array.isArray(datos) ? datos : (datos.productos || datos.items || datos.lista || datos.resultados || Object.values(datos).find(v => Array.isArray(v)) || []);
  lista = lista.map(x => typeof x === 'string' ? { producto: x } : { ...x, producto: x.producto || x.nombre || x.name || x.titulo || x.product || x.title }).filter(x => x && x.producto);
  const nuevos = lista.filter(x => !ya.has(String(x.producto).toLowerCase()));
  if (!nuevos.length) registrar('exploracion', `La búsqueda devolvió ${lista.length} productos y ninguno nuevo`);
  return nuevos;
}
async function analizar(nombre, origen) {
  const { datos, fuentes, web } = await ia.json(`Hacé un análisis MINUCIOSO del producto "${nombre}" para venderlo en Argentina en Mercado Libre y en una página web propia, comprándolo al proveedor más conveniente (internacional o local).
Buscá en internet y COMPARÁ en todas las plataformas: publicaciones reales de Mercado Libre Argentina con "+X vendidos", Amazon, AliExpress, Temu, Shein, eBay; proveedores en Alibaba, 1688, DHgate, Made-in-China, CJ Dropshipping y mayoristas/fabricantes ARGENTINOS (con precio en pesos). Para cada uno: precio, unidades vendidas, MOQ y el LINK EXACTO de la publicación. Conseguí la URL directa de la FOTO del producto.
Incluí tendencia, estacionalidad y meses pico, qué busca la gente, quejas, regulaciones, cómo obtener la MÁXIMA ganancia y, si vende mucho (más de 1000 unidades), alternativas de mejor calidad o menor costo para la página web con su costo y precio sugerido.
${CRITERIOS()}
Devolvé SOLO un JSON con esta forma (números como números, sin texto extra):
${ESQUEMA}`, true);
  // acepta el análisis aunque venga envuelto o con otros nombres de campo
  let p = Array.isArray(datos) ? datos[0] : datos;
  if (p && typeof p === 'object' && !p.nombre && !p.precio_venta_sugerido_ars) {
    const dentro = Object.values(p).filter(v => v && typeof v === 'object' && !Array.isArray(v)).sort((a, b) => Object.keys(b).length - Object.keys(a).length)[0];
    if (dentro && Object.keys(dentro).length >= 5) p = dentro;
  }
  if (!p || typeof p !== 'object') throw new Error('análisis vacío');
  p.nombre = p.nombre || p.producto || p.name || p.titulo || nombre;
  if (!p.costo_proveedor_usd && !(p.proveedores || []).length) throw new Error('el análisis no trajo precio de proveedor');
  Object.assign(p, { fuentes: [...(p.fuentes || []), ...(fuentes || [])].slice(0, 15), origen, creado: ahora(), busqueda_web: web });
  let k = slug(p.nombre); if (E.productos[k]) k += '-' + id().slice(-4);
  E.productos[k] = p;
  const ev = evaluar(p);
  if (ev.veredicto === 'VENDER') { encolarWhatsApp(k, p, ev); registrar('oportunidad', 'Producto encontrado: ' + p.nombre) }
  return { k, ev };
}

// ------------------------------------------------------------ WhatsApp (solo de 10 a 13 y de 17 a 22, hora de Argentina)
function encolarWhatsApp(k, p, ev) {
  const link = p.fuente_principal?.url || (p.precios_mercados || []).find(m => m.url)?.url || (p.fuentes || [])[0]?.url || '';
  const txt = `Producto encontrado: ${p.nombre}\nConviene en: ${(ev.canales || []).join(' y ')}\nMercado Libre: precio ${ars(ev.r.precio)}, ganancia ${ars(ev.r.ganancia)} por unidad\nTu web: precio ${ars(ev.w.precio)}, ganancia ${ars(ev.w.ganancia)} por unidad\nVentas: ${String(p.demanda?.prueba_de_ventas || '').slice(0, 150)}\n${link}${PAGINA ? '\nDetalle: ' + PAGINA : ''}`;
  E.cola_wa.push({ k, txt, creado: ahora() });
}
function horaArgentina() {
  const f = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const h = +f.find(x => x.type === 'hour').value, m = +f.find(x => x.type === 'minute').value; return h * 60 + m;
}
const enHorario = () => { const t = horaArgentina(); return (config.whatsapp_horarios || [[10, 13], [17, 22]]).some(([a, b]) => t >= a * 60 && t <= b * 60) };
async function enviarWhatsApp(txt) {
  if (!env.WA_TELEFONO || !env.WA_APIKEY) throw new Error('faltan WA_TELEFONO o WA_APIKEY');
  // Opción GREEN-API (gratis, plan Developer): WA_APIKEY = green:ID_INSTANCIA:TOKEN  (o green:ID:TOKEN:https://xxxx.api.greenapi.com)
  const g = String(env.WA_APIKEY).trim().match(/^green:(\d+):([^:]+)(?::(https?:\/\/.+))?$/i);
  if (g) {
    const base = (g[3] || 'https://api.green-api.com').replace(/\/$/, '');
    const chatId = env.WA_TELEFONO.replace(/\D/g, '') + '@c.us';
    if (env.MOCK) { E.wa_enviados = (E.wa_enviados || 0) + 1; return }
    const r = await fetch(`${base}/waInstance${g[1]}/sendMessage/${g[2]}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId, message: txt }) });
    const t = await r.text(); if (!r.ok || !/idMessage/.test(t)) throw new Error('Green-API respondió: ' + t.slice(0, 160));
    return;
  }
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(env.WA_TELEFONO.replace(/[^\d+]/g, ''))}&text=${encodeURIComponent(txt)}&apikey=${encodeURIComponent(env.WA_APIKEY)}`;
  if (env.MOCK) { E.wa_enviados = (E.wa_enviados || 0) + 1; return }
  const r = await fetch(url); const t = await r.text();
  if (!r.ok || /error|invalid|not/i.test(t) && !/queued|sent|enviado/i.test(t)) throw new Error('CallMeBot respondió: ' + t.replace(/<[^>]+>/g, ' ').slice(0, 140));
}
async function despacharWhatsApp() {
  if (!E.cola_wa.length) return;
  if (!enHorario()) { log(`WhatsApp: ${E.cola_wa.length} avisos esperando el horario (10-13 y 17-22)`); return }
  if (!env.WA_TELEFONO || !env.WA_APIKEY) { log('WhatsApp no configurado'); return }
  let n = 0;
  while (E.cola_wa.length && n < 6) {
    const m = E.cola_wa[0];
    try { await enviarWhatsApp(m.txt); E.cola_wa.shift(); n++; registrar('whatsapp', 'Aviso enviado: ' + m.txt.split('\n')[0]); await esperar(8000) }
    catch (e) { registrar('error', 'WhatsApp: ' + e.message); break }
  }
}

// ------------------------------------------------------------ pedidos (formulario de la página → "issue" de GitHub)
const NUMS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15, veinte: 20 };
async function procesarPedido(texto) {
  texto = String(texto || '').replace(/^\s*pedido\s*:?\s*/i, '').trim();
  const an = texto.match(/^(?:analiz[aá]|analizame|investig[aá])\s+(?:el |la |los |las |un |una )?(.+)/i);
  if (an) { const { ev } = await analizar(an[1], 'pedido'); return ev.veredicto === 'VENDER' ? 1 : 0 }
  const m = texto.match(/(\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte)\s+productos?/i);
  const N = Math.min(15, m ? (parseInt(m[1]) || NUMS[m[1].toLowerCase()] || 5) : 5);
  let buenos = 0, ronda = 0;
  while (buenos < N && ronda < 5 && cupo()) {
    ronda++;
    const cands = (await proponer(Math.min(N - buenos + 4, 12), texto)).slice(0, N - buenos + 4);
    if (!cands.length) break;
    for (const c of cands) {
      if (!cupo() || buenos >= N) break;
      try { const { ev } = await analizar(c.producto, 'pedido'); if (ev.veredicto === 'VENDER') buenos++ } catch (e) { registrar('error', c.producto + ': ' + e.message) }
      guardar(); await esperar(3000);
    }
  }
  registrar('pedido', `Pedido "${texto}": ${buenos} productos para vender`);
  return buenos;
}
async function github(ruta, metodo, cuerpo) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY || env.MOCK) return;
  await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}${ruta}`, { method: metodo, headers: { Authorization: 'Bearer ' + env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }).catch(() => { });
}

// ------------------------------------------------------------ aprendizaje continuo
async function aprender() {
  const temas = EST.temas, tema = temas[(E.i_tema || 0) % temas.length]; E.i_tema = (E.i_tema || 0) + 1;
  const { datos, fuentes } = await ia.json(`Investigá en internet (información actual) el tema: "${tema}", para un vendedor de Argentina que vende en Mercado Libre y en su web. SOLO JSON: {"lecciones":[{"titulo","contenido":"concreto y accionable","confianza":1-5}]} (máximo 4).`, true);
  (datos.lecciones || []).forEach(l => E.conocimiento[id()] = { tipo: 'leccion', ...l, fuente: 'Investigación: ' + tema, url: fuentes?.[0]?.url || '', fecha: ahora() });
  registrar('aprendizaje', `Investigué "${tema}"`);
  const lec = Object.values(E.conocimiento).filter(c => c.tipo === 'leccion' || c.tipo === 'regla');
  if (lec.length >= 6 && cupo()) {
    const { datos: d2 } = await ia.json(`Resumí estas lecciones y reglas en un máximo de 25 reglas prácticas para vender en Argentina, sin duplicados ni contradicciones.
${JSON.stringify(lec.slice(-80).map(c => ({ t: c.titulo, c: c.contenido })))}
SOLO JSON: {"reglas":[{"titulo","contenido","confianza":1-5}]}`, false);
    if ((d2.reglas || []).length >= 4) {
      for (const [k, c] of Object.entries(E.conocimiento)) if (c.tipo === 'regla') delete E.conocimiento[k];
      d2.reglas.forEach(r => E.conocimiento[id()] = { tipo: 'regla', ...r, fuente: 'Resumen de lo aprendido', fecha: ahora() });
    }
  }
  // no guardar más de 300 lecciones
  const todas = Object.entries(E.conocimiento).filter(([, c]) => c.tipo === 'leccion').sort((a, b) => a[1].fecha < b[1].fecha ? 1 : -1);
  todas.slice(300).forEach(([k]) => delete E.conocimiento[k]);
}
async function videos() {
  const t = EST.temasVideo, tema = t[(E.i_yt || 0) % t.length]; E.i_yt = (E.i_yt || 0) + 1;
  const { datos } = await ia.json(`Buscá en internet 2 videos de YouTube recientes, con muchas vistas y de canales serios, sobre "${tema}" (preferentemente en español). SOLO JSON: {"videos":[{"titulo","canal","url":"https://www.youtube.com/watch?v=..."}]}`, true);
  for (const v of (datos.videos || []).filter(v => /youtu\.?be/.test(v.url || '')).slice(0, 2)) {
    if (!cupo()) break;
    const pedido = `Extraé las enseñanzas prácticas de este video sobre "${tema}" para un vendedor de Argentina. SOLO JSON: {"lecciones":[{"titulo","contenido":"concreto y accionable","confianza":1-5}]} (máximo 4).`;
    let texto; try { texto = await ia.video(v.url, pedido) } catch (e) { texto = (await ia.pedir(`Buscá en internet el contenido o resumen del video de YouTube ${v.url} ("${v.titulo}"). ${pedido}`, { web: true })).text }
    const d = ia.extraerJSON(texto);
    (d.lecciones || []).forEach(l => E.conocimiento[id()] = { tipo: 'leccion', ...l, fuente: 'YouTube: ' + (v.titulo || v.url) + (v.canal ? ' (' + v.canal + ')' : ''), url: v.url, fecha: ahora() });
    registrar('aprendizaje', `Estudié el video "${v.titulo || v.url}"`);
  }
}
async function capital() {
  const { datos, fuentes } = await ia.json(`Investigá en internet las tasas y rendimientos ACTUALES en Argentina (hoy ${new Date().toLocaleDateString('es-AR')}) para hacer rendir el capital ganado por un vendedor: plazo fijo, cuentas remuneradas, fondos money market, cauciones, bonos (CER, dólar linked, hard dollar), CEDEARs, acciones argentinas, obligaciones negociables, dólar MEP, y reinvertir en mercadería. Para cada una: rendimiento aproximado anual, riesgo, liquidez y cómo empezar. Datos reales y con fecha; no inventes.
SOLO JSON: {"resumen":"2 o 3 frases","inflacion_esperada":"dato y fuente","opciones":[{"nombre","rendimiento_aprox","riesgo":"bajo|medio|alto","liquidez","como_empezar","conviene_si"}],"estrategia_sugerida":"cómo repartir: parte para stock, parte para liquidez, parte para inversión"}`, true);
  for (const [k, c] of Object.entries(E.conocimiento)) if (c.tipo === 'capital') delete E.conocimiento[k];
  E.conocimiento['capital'] = { tipo: 'capital', titulo: 'Capital ' + new Date().toLocaleDateString('es-AR'), datos, fuentes: (fuentes || []).slice(0, 8), fecha: ahora() };
  registrar('capital', 'Actualicé las alternativas de inversión');
}
async function informe() {
  const top = prods().filter(p => p.ev.veredicto === 'VENDER').sort((a, b) => b.ev.puntaje - a.ev.puntaje).slice(0, 8)
    .map(p => ({ n: p.nombre, conviene_en: p.ev.canales, ganancia_ml: Math.round(p.ev.r.ganancia), ganancia_web: Math.round(p.ev.w.ganancia) }));
  const r = await ia.pedir(`Escribí el informe diario (markdown breve) para el vendedor. Hablá SOLO de los productos que conviene vender; NO menciones productos descartados ni problemas técnicos. Si no hay productos todavía, decilo en una frase y explicá qué vas a buscar. Secciones: 1) productos para vender hoy, con ganancia por unidad, 2) qué aprendí del mercado, 3) UNA acción concreta para hoy. Datos: ${JSON.stringify(top)}. Reglas aprendidas: ${conoc('regla').slice(0, 10).map(c => c.titulo).join(' | ')}`);
  E.conocimiento['informe'] = { tipo: 'informe', titulo: 'Informe del ' + new Date().toLocaleDateString('es-AR'), contenido: r.text, fecha: ahora() };
}

// ------------------------------------------------------------ auto-mejora: RADAR reescribe su propia estrategia y la prueba antes de usarla
async function autoMejora() {
  const ps = prods(), actual = fs.readFileSync(R('lib/estrategia.mjs'), 'utf8');
  const resumen = ps.slice(-150).map(p => ({ n: p.nombre, cat: p.categoria, v: p.ev.veredicto, precio: Math.round(p.ev.precio || 0), costo_usd: p.ev.costo, ml: p.ev.r ? Math.round(p.ev.r.ganancia) : null, web: p.ev.w ? Math.round(p.ev.w.ganancia) : null, ventas: p.ev.ventas }));
  const r = await ia.pedir(`Sos el sistema RADAR y te estás auto-mejorando. Este es tu archivo de estrategia actual (JavaScript, módulo ES):
\`\`\`js
${actual}
\`\`\`
Estos son tus resultados (v = veredicto; ml y web = ganancia por unidad en pesos): ${JSON.stringify(resumen)}
${CRITERIOS()}
Analizá qué categorías, precios y tipos de producto dieron productos aprobados y cuáles fallaron. Reescribí el archivo COMPLETO para encontrar más productos que cumplan: reordená y cambiá categorías, temas de estudio y de video, y mejorá instruccionesBusqueda(ctx) (ctx tiene: vuelta, mes, aprobados). Reglas obligatorias: mismo formato y mismos nombres exportados (VERSION, categorias, temas, temasVideo, productosPorVuelta, instruccionesBusqueda); VERSION = ${(EST.VERSION || 1) + 1}; productosPorVuelta entre 1 y 3; sin import, fetch, process, eval ni temporizadores; solo texto y lógica simple. En la PRIMERA línea poné un comentario: // CAMBIOS: (resumen en una frase de lo que mejoraste).
Devolvé SOLO el archivo dentro de un bloque \`\`\`js.`);
  const m = r.text.match(/```(?:js|javascript)?\s*([\s\S]*?)```/); if (!m) throw new Error('no devolvió código');
  const nuevo = m[1].trim() + '\n', tmp = R('lib/estrategia.nueva.mjs');
  fs.writeFileSync(tmp, nuevo);
  try {
    await validarEstrategia(tmp);
    fs.copyFileSync(R('lib/estrategia.mjs'), R('data/estrategia.anterior.mjs'));
    fs.renameSync(tmp, R('lib/estrategia.mjs'));
    EST = await import(pathToFileURL(R('lib/estrategia.mjs')).href + '?v=' + Date.now());
    const cambios = (nuevo.match(/^\/\/\s*CAMBIOS:\s*(.*)$/m) || [])[1] || 'Ajusté mi estrategia de búsqueda.';
    E.conocimiento['mejora-' + ahora().slice(0, 10)] = { tipo: 'mejora', titulo: `Auto-mejora v${EST.VERSION} · ${new Date().toLocaleDateString('es-AR')}`, contenido: cambios, fecha: ahora() };
    registrar('mejora', `Me reprogramé (versión ${EST.VERSION}): ${cambios}`);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    registrar('mejora', 'Probé una mejora pero no pasó las pruebas; sigo con la versión anterior (' + e.message + ')');
  }
}

// ------------------------------------------------------------ página de resultados
const [OWNER, REPO] = String(env.GITHUB_REPOSITORY || '/').split('/');
const PAGINA = OWNER && REPO ? `https://${OWNER.toLowerCase()}.github.io/${REPO}/` : '';
function publicar() {
  const ps = prods(), vend = ps.filter(p => p.ev.veredicto === 'VENDER').sort((a, b) => b.ev.puntaje - a.ev.puntaje);
  const salida = {
    generado: ahora(), version_estrategia: EST.VERSION, dolar: CFG.dolar_oficial, ia_hoy: ia.usadas(),
    criterios: { ml_a: CFG.margen_minimo_pct, ml_b: CFG.ml_ganancia_min_pct_costo, web: CFG.web.margen_min_pct_precio, whatsapp: config.whatsapp_horarios },
    totales: { analizados: ps.length, aprobados: vend.length, en_cola_whatsapp: E.cola_wa.length },
    productos: vend.map(p => { const { ev, ...resto } = p; return { ...resto, ev: { veredicto: ev.veredicto, puntaje: ev.puntaje, canales: ev.canales, ventas: ev.ventas, costo: ev.costo, precio: ev.precio, r: ev.r, w: ev.w, ms: ev.ms } } }),
    reglas: conoc('regla').slice(0, 30), lecciones: conoc('leccion').slice(0, 80), mejoras: conoc('mejora').slice(0, 30),
    capital: E.conocimiento.capital || null, informe: E.conocimiento.informe || null, actividad: E.actividad.slice(0, 40),
    repo: env.GITHUB_REPOSITORY || ''
  };
  fs.mkdirSync(R('docs'), { recursive: true });
  fs.writeFileSync(R('docs/datos.enc'), encriptar(salida, CLAVE));
}
function guardar() { fs.mkdirSync(R('data'), { recursive: true }); fs.writeFileSync(ARCH, encriptar(E, CLAVE)); publicar() }

// ------------------------------------------------------------ vuelta de trabajo
async function vuelta() {
  log(`RADAR v${EST.VERSION} · evento: ${env.EVENTO || 'manual'} · productos guardados: ${Object.keys(E.productos).length}`);
  for (const k of String(env.FORZAR || '').split(',').filter(Boolean)) delete E.ultimos[k.trim()];
  if (horasDesde('dolar') > 6) { try { const r = await fetch('https://dolarapi.com/v1/dolares/oficial'); const j = await r.json(); if (j.venta) { E.dolar = j.venta; CFG = usarConfig({ ...config, dolar_oficial: j.venta }) } } catch (e) { } marcar('dolar') }

  if (env.EVENTO === 'issues' && env.PEDIDO_TITULO) {
    const cuerpo = String(env.PEDIDO_TEXTO || ''), texto = env.PEDIDO_TITULO + (/^Pedido enviado desde/i.test(cuerpo) ? '' : ' ' + cuerpo);
    let n = 0; try { n = await procesarPedido(texto) } catch (e) { registrar('error', 'pedido: ' + e.message) }
    await github(`/issues/${env.PEDIDO_NUM}/comments`, 'POST', { body: `✅ Listo. Encontré **${n}** producto(s) que conviene vender. Miralos en tu página: ${PAGINA}\n\n(Los detalles están encriptados: solo se ven con tu contraseña.)` });
    await github(`/issues/${env.PEDIDO_NUM}`, 'PATCH', { state: 'closed' });
  } else {
    E.vuelta = (E.vuelta || 0) + 1;
    const tareas = [
      ['explorar', 0, async () => { const c = await proponer(EST.productosPorVuelta + 1); let n = 0, ok = 0; for (const x of c.slice(0, EST.productosPorVuelta)) { if (!cupo()) break; try { const { ev } = await analizar(x.producto, 'exploracion'); n++; if (ev.veredicto === 'VENDER') ok++ } catch (e) { registrar('error', x.producto + ': ' + e.message) } guardar(); await esperar(3000) } if (n) registrar('exploracion', `Analicé ${n} productos nuevos; ${ok} cumplen tus reglas`) }],
      ['aprender', 4, aprender], ['videos', 12, videos], ['capital', 20, capital], ['informe', 20, informe], ['automejora', 24, autoMejora]
    ];
    for (const [k, h, f] of tareas) {
      if (!cupo()) break;
      if (k === 'automejora' && Object.keys(E.productos).length < 5) continue;
      if (horasDesde(k) >= h) { try { await f() } catch (e) { registrar('error', k + ': ' + e.message) } marcar(k); guardar() }
    }
  }
  await despacharWhatsApp();
  guardar();
  log(`Terminé. Consultas a la IA hoy: ${ia.usadas()} · aprobados: ${prods().filter(p => p.ev.veredicto === 'VENDER').length} · avisos en espera: ${E.cola_wa.length}`);
}
await vuelta();
