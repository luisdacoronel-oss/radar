// Inteligencias artificiales gratis: Google Gemini (con búsqueda en Google) y Groq (con búsqueda web) como respaldo.
// Si una se queda sin cupo, sigue con la otra.
export const ESTILO = `ESTILO OBLIGATORIO DE REDACCIÓN: español claro, tono profesional, formal y sencillo, como un asesor comercial serio. Tratá al usuario de "vos" con respeto (Argentina), SIN lunfardo, jerga, modismos ni chistes. Frases cortas, palabras comunes, cifras concretas. Nunca inventes datos.\n\n`;

const G = 'https://generativelanguage.googleapis.com/v1beta';
let MOCK = null;
export function usarMock(f) { MOCK = f }

export function crearIA(estado, claves) {
  const ia = estado.ia || (estado.ia = {});
  const hoy = () => new Date().toISOString().slice(0, 10);
  const contar = () => { if (ia.dia !== hoy()) { ia.dia = hoy(); ia.n = 0 } ia.n++ };
  const usadas = () => (ia.dia === hoy() ? ia.n : 0);
  const bloq = ia.bloqueados || (ia.bloqueados = {});

  async function modelosGoogle() {
    if (ia.modelos && ia.modelos_dia === hoy()) return ia.modelos;
    let ms = [];
    try {
      const r = await fetch(`${G}/models?pageSize=200&key=${claves.gemini}`); const j = await r.json();
      ms = (j.models || []).filter(x => (x.supportedGenerationMethods || []).includes('generateContent')).map(x => x.name.replace('models/', ''))
        .filter(n => /^gemini-/.test(n) && /flash/.test(n) && !/image|tts|live|audio|thinking|exp|8b|embedding|robotics|computer/.test(n));
    } catch (e) { }
    const pref = n => (/^gemini-2\.5-flash$/.test(n) ? 0 : /^gemini-flash-latest$/.test(n) ? 1 : /^gemini-2\.5-flash-lite$/.test(n) ? 2 : /^gemini-flash-lite-latest$/.test(n) ? 3 : /lite/.test(n) ? 5 : 4) + (/preview/.test(n) ? 0.5 : 0);
    ms = [...new Set([...ms, 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest'])].sort((a, b) => pref(a) - pref(b));
    ia.modelos = ms; ia.modelos_dia = hoy(); return ms;
  }
  async function llamarGoogle(model, body) {
    const r = await fetch(`${G}/models/${model}:generateContent?key=${claves.gemini}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { r, j: await r.json().catch(() => ({})) };
  }
  async function google(prompt, web, partes) {
    const ms = await modelosGoogle(), ok = ia.modelo, orden = ok ? [ok, ...ms.filter(x => x !== ok)] : ms;
    const intentos = []; if (web) orden.forEach(m => intentos.push([m, true])); orden.forEach(m => intentos.push([m, false]));
    let err = '', n = 0;
    for (const [model, conWeb] of intentos) {
      const k = model + (conWeb ? '+web' : ''); if (bloq[k] > Date.now()) continue; if (n++ >= 7) break;
      const body = { contents: [{ role: 'user', parts: [...(partes || []), { text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 8192 } };
      if (conWeb) body.tools = [{ google_search: {} }];
      let r, j; try { ({ r, j } = await llamarGoogle(model, body)) } catch (e) { err = 'sin conexión'; break }
      contar();
      if (r.ok) {
        const c = j.candidates?.[0], text = (c?.content?.parts || []).map(x => x.text || '').join('');
        if (!text) { err = 'respuesta vacía'; continue }
        ia.modelo = model;
        const fuentes = (c?.groundingMetadata?.groundingChunks || []).map(g => ({ titulo: g.web?.title || g.web?.uri, url: g.web?.uri })).filter(f => f.url);
        return { text, fuentes, web: conWeb, model };
      }
      const msg = j.error?.message || ('Error ' + r.status); err = msg;
      if (r.status === 400 && /API key/i.test(msg)) throw new Error('clave de Google inválida');
      bloq[k] = Date.now() + (r.status === 429 ? (/limit: ?0\b/.test(msg) ? 864e5 : 36e5) : [400, 403, 404].includes(r.status) ? 864e5 : 6e5);
      if (ia.modelo === model) delete ia.modelo;
    }
    throw new Error('Google sin cupo: ' + err.slice(0, 160));
  }
  async function groq(prompt, web) {
    const intentos = []; if (web) intentos.push(['groq/compound', true], ['groq/compound-mini', true]);
    ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'qwen/qwen3-32b', 'llama-3.1-8b-instant'].forEach(m => intentos.push([m, false]));
    let err = '';
    for (const [model, conWeb] of intentos) {
      const k = 'groq:' + model; if (bloq[k] > Date.now()) continue;
      let r, j; try {
        r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + claves.groq },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt.slice(0, conWeb ? 20000 : 24000) }], temperature: 0.4, max_tokens: conWeb ? 6000 : 7000 }) });
        j = await r.json().catch(() => ({}));
      } catch (e) { err = 'sin conexión'; break }
      contar();
      if (r.ok) {
        const text = (j.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim(); if (!text) { err = 'vacía'; continue }
        const fuentes = []; (j.choices?.[0]?.message?.executed_tools || []).forEach(t => (t.search_results?.results || []).forEach(x => x.url && fuentes.push({ titulo: x.title || x.url, url: x.url })));
        return { text, fuentes: fuentes.slice(0, 12), web: conWeb, model: 'groq ' + model };
      }
      const msg = j.error?.message || ('Error ' + r.status); err = msg;
      if (r.status === 401) throw new Error('clave de Groq inválida');
      bloq[k] = Date.now() + (r.status === 429 ? (/per day|TPD|RPD/i.test(msg) ? 3 * 36e5 : 12e4) : [400, 404].includes(r.status) ? 864e5 : 6e5);
    }
    throw new Error('Groq sin cupo: ' + err.slice(0, 160));
  }
  async function pedir(prompt, { web = false } = {}) {
    prompt = ESTILO + prompt;
    if (MOCK) { contar(); return MOCK(prompt, web) }
    const errores = [];
    if (claves.gemini) { try { return await google(prompt, web) } catch (e) { errores.push(e.message) } }
    if (claves.groq) { try { return await groq(prompt, web) } catch (e) { errores.push(e.message) } }
    throw new Error(errores.join(' | ') || 'no hay claves de IA');
  }
  // Encuentra el JSON aunque la respuesta traiga texto, citas [1] [2] o bloques de código
  function extraerJSON(t) {
    t = String(t || '');
    const bloques = [...t.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map(m => m[1]);
    const intentos = [...bloques, t];
    let mejor = null, largo = 0;
    for (const txt of intentos) {
      const limpio = txt.replace(/\[(\d+(?:,\s*\d+)*)\](?!\s*[:,\]}])/g, '');
      for (const fuente of [txt, limpio]) {
        const inicios = []; for (let i = 0; i < fuente.length; i++) if (fuente[i] === '{' || fuente[i] === '[') inicios.push(i);
        for (const i of inicios.slice(0, 60)) {
          const cierre = fuente[i] === '{' ? '}' : ']';
          let f = fuente.lastIndexOf(cierre);
          for (let k = 0; k < 8 && f > i; k++) {
            try { const v = JSON.parse(fuente.slice(i, f + 1)); const tam = f - i; if (tam > largo && (typeof v === 'object')) { mejor = v; largo = tam } break } catch (e) { f = fuente.lastIndexOf(cierre, f - 1) }
          }
        }
        if (mejor && largo > 20) return mejor;
      }
    }
    if (mejor) return mejor;
    throw new Error('respuesta sin JSON');
  }
  async function json(prompt, web) {
    const r = await pedir(prompt, { web });
    try { return { datos: extraerJSON(r.text), fuentes: r.fuentes, web: r.web } }
    catch (e) { const r2 = await pedir('Convertí este texto en JSON válido, sin texto extra:\n\n' + r.text.slice(0, 30000)); return { datos: extraerJSON(r2.text), fuentes: r.fuentes, web: r.web } }
  }
  async function video(url, prompt) {
    if (MOCK) return (await MOCK(ESTILO + prompt, false)).text;
    if (!claves.gemini) throw new Error('sin clave de Google');
    const ms = await modelosGoogle(); let err = '';
    for (const model of ms.slice(0, 3)) {
      try {
        const { r, j } = await llamarGoogle(model, { contents: [{ role: 'user', parts: [{ file_data: { file_uri: url } }, { text: ESTILO + prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 6000 } }); contar();
        if (r.ok) { const t = (j.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join(''); if (t) return t }
        err = j.error?.message || r.status;
      } catch (e) { err = e.message }
    }
    throw new Error('no pude ver el video: ' + String(err).slice(0, 120));
  }
  return { pedir, json, video, extraerJSON, usadas };
}
