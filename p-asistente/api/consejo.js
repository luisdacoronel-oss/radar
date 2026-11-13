// Asistente P. — Cerebro multi-IA (función de Vercel, gratis)
// P. llama a /api/consejo con la pregunta y la conversación reciente.
//
// Modos:
//   "rapido"  → responde la primera IA que termine (ideal para la voz: poca demora).
//   "consejo" → consulta TODAS las IA gratuitas, compara y redacta la mejor respuesta (para decisiones).
//   "auto"    → elige solo: consejo si la pregunta es de decisión/dinero/salud/comparación; rápido si es charla.
//
// Pedido:  POST { "pregunta": "...", "conversacion": [{role:"user"|"assistant", content:"..."}], "modo": "auto" }
// Respuesta: { "respuesta": "...", "modo": "...", "opiniones": [{nombre, texto|error, ms}] }

import { consultarTodas, sintetizar, proveedoresActivos, PROVEEDORES } from '../lib/ia.mjs';

const SISTEMA = `Usted es P., el asistente personal de Luis. Hable en español rioplatense neutro, en tono formal y sencillo, sin modismos.
Sea conversacional y concreto: respuestas breves para charla, completas cuando se pide análisis.
Si no sabe algo o el dato puede haber cambiado, dígalo y no invente.
Fecha y hora actual en Argentina: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}.`;

const ES_DECISION = /(conviene|invert|comprar|vender|elegir|cu[aá]l es mejor|compar|recomend|decid|salud|m[eé]dic|contrato|ley|impuesto|riesgo|d[oó]lar|plazo fijo|acci[oó]n|cedear|cripto)/i;

// Orden de velocidad para el modo rápido
const RAPIDOS = ['groq', 'cerebras', 'gemini', 'mistral', 'openrouter', 'github'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const { pregunta = '', conversacion = [], modo = 'auto', pesos = {} } = req.body || {};
  if (!pregunta.trim()) return res.status(400).json({ error: 'Falta la pregunta' });

  const mensajes = [...conversacion.slice(-20), { role: 'user', content: pregunta }];
  const modoFinal = modo === 'auto' ? (ES_DECISION.test(pregunta) ? 'consejo' : 'rapido') : modo;
  const activos = proveedoresActivos();
  if (!activos.length) return res.status(500).json({ error: 'No hay claves de IA cargadas en Vercel (Settings → Environment Variables).' });

  try {
    if (modoFinal === 'rapido') {
      const orden = RAPIDOS.filter(id => activos.includes(id)).slice(0, 3);
      const intentos = orden.map(id => consultarTodas(SISTEMA, mensajes, { proveedores: [id], tiempo: 15000 })
        .then(([r]) => (r && r.texto ? r : Promise.reject(r))));
      const r = await Promise.any(intentos);
      return res.status(200).json({ respuesta: r.texto, modo: 'rapido', opiniones: [{ nombre: r.nombre, ms: r.ms }] });
    }
    const todas = await consultarTodas(SISTEMA, mensajes, { tiempo: 40000 });
    const final = await sintetizar(pregunta, todas, pesos);
    return res.status(200).json({
      respuesta: final || 'Ninguna IA pudo responder en este momento.',
      modo: 'consejo',
      opiniones: todas.map(r => ({ nombre: r.nombre, texto: r.texto, error: r.error, ms: r.ms })),
    });
  } catch (e) {
    return res.status(502).json({ error: 'Ninguna IA respondió a tiempo', detalle: String(e?.message || e) });
  }
}
