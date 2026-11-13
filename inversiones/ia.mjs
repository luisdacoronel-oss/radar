// RADAR · Consejo de IAs gratuitas
// Consulta en paralelo todas las IA gratuitas que tengan clave cargada y devuelve cada respuesta.
// Sirve para el módulo de inversiones (GitHub Actions) y para el asistente P. (Vercel).
//
// Claves (todas gratuitas, se cargan como "secrets"/variables de entorno):
//   GITHUB_TOKEN        → GitHub Models (automático dentro de GitHub Actions, sin registrarse)
//   GEMINI_API_KEY      → Google AI Studio  (aistudio.google.com)
//   GROQ_API_KEY        → Groq              (console.groq.com)
//   OPENROUTER_API_KEY  → OpenRouter, modelos ":free" (openrouter.ai)
//   MISTRAL_API_KEY     → Mistral, plan "Experiment" gratuito (console.mistral.ai)
//   CEREBRAS_API_KEY    → Cerebras          (cloud.cerebras.ai)
// Los modelos se pueden cambiar con variables *_MODEL sin tocar el código.

// Acepta también los nombres de clave que RADAR ya usa (GEMINI_KEY, GROQ_KEY)
const ALIAS = { GEMINI_API_KEY: 'GEMINI_KEY', GROQ_API_KEY: 'GROQ_KEY' };
const env = (k, def) => (typeof process !== 'undefined' && (process.env[k] || (ALIAS[k] && process.env[ALIAS[k]]))) || def;

// Cada proveedor tiene una lista de modelos de respaldo: si uno se retira o no está disponible,
// se prueba el siguiente. Gemini y Groq además buscan solos los modelos vigentes.
export const PROVEEDORES = {
  github: {
    nombre: 'GitHub Models', clave: 'GITHUB_TOKEN', tipo: 'openai',
    urls: ['https://models.github.ai/inference/chat/completions', 'https://models.inference.ai.azure.com/chat/completions'],
    modelos: () => [env('GITHUB_MODEL'), 'openai/gpt-4.1-mini', 'openai/gpt-4o-mini', 'gpt-4o-mini', 'meta/Llama-3.3-70B-Instruct'].filter(Boolean),
  },
  gemini: {
    nombre: 'Google Gemini', clave: 'GEMINI_API_KEY', tipo: 'gemini',
    modelos: () => [env('GEMINI_MODEL'), 'gemini-flash-latest', 'gemini-flash-lite-latest'].filter(Boolean),
  },
  groq: {
    nombre: 'Groq', clave: 'GROQ_API_KEY', tipo: 'openai', urls: ['https://api.groq.com/openai/v1/chat/completions'],
    modelos: () => [env('GROQ_MODEL'), 'openai/gpt-oss-120b', 'qwen/qwen3-32b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'].filter(Boolean),
  },
  openrouter: {
    nombre: 'OpenRouter', clave: 'OPENROUTER_API_KEY', tipo: 'openai', urls: ['https://openrouter.ai/api/v1/chat/completions'],
    modelos: () => [env('OPENROUTER_MODEL'), 'openrouter/free', 'meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat-v3-0324:free'].filter(Boolean),
  },
  mistral: {
    nombre: 'Mistral', clave: 'MISTRAL_API_KEY', tipo: 'openai', urls: ['https://api.mistral.ai/v1/chat/completions'],
    modelos: () => [env('MISTRAL_MODEL'), 'mistral-small-latest', 'mistral-medium-latest', 'open-mistral-nemo'].filter(Boolean),
  },
  cerebras: {
    nombre: 'Cerebras', clave: 'CEREBRAS_API_KEY', tipo: 'openai', urls: ['https://api.cerebras.ai/v1/chat/completions'],
    modelos: () => [env('CEREBRAS_MODEL'), 'gpt-oss-120b', 'llama-3.3-70b', 'qwen-3-32b', 'llama3.1-8b'].filter(Boolean),
  },
};

export function proveedoresActivos(lista = Object.keys(PROVEEDORES)) {
  return lista.filter(id => PROVEEDORES[id] && env(PROVEEDORES[id].clave));
}

// Modelos vigentes, consultados al proveedor (se guardan en memoria durante la ejecución)
const cacheModelos = {};
async function modelosVigentes(id, clave) {
  if (cacheModelos[id]) return cacheModelos[id];
  let lista = [];
  try {
    if (id === 'gemini') {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=300&key=${clave}`, { signal: AbortSignal.timeout(15000) });
      const j = await r.json();
      const ver = n => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
      lista = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace('models/', ''))
        .filter(n => /^gemini-/.test(n) && /flash/.test(n) && !/image|tts|live|audio|native|thinking|exp|8b|embedding|robotics|computer/.test(n))
        .sort((a, b) => (ver(b) - ver(a)) || (/lite/.test(a) - /lite/.test(b)) || (/preview/.test(a) - /preview/.test(b)));
    } else if (id === 'groq') {
      const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${clave}` }, signal: AbortSignal.timeout(15000) });
      const j = await r.json();
      const ids = (j.data || []).map(m => m.id).filter(x => !/whisper|guard|tts|playai|compound|prompt/i.test(x));
      lista = PROVEEDORES.groq.modelos().filter(m => ids.includes(m)).concat(ids.filter(x => /120b|70b|32b/.test(x)));
    }
  } catch {}
  cacheModelos[id] = [...new Set([...PROVEEDORES[id].modelos(), ...lista])];
  if (id === 'gemini') cacheModelos[id] = [...new Set([...(env('GEMINI_MODEL') ? [env('GEMINI_MODEL')] : []), ...lista, ...PROVEEDORES.gemini.modelos()])];
  return cacheModelos[id];
}

async function intentar(id, modelo, url, clave, sistema, mensajes, json, temperatura, tiempo) {
  const p = PROVEEDORES[id];
  if (p.tipo === 'gemini') {
    const body = {
      systemInstruction: { parts: [{ text: sistema }] },
      contents: mensajes.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { temperature: temperatura, ...(json ? { responseMimeType: 'application/json' } : {}) },
    };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${clave}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(tiempo) });
    const t = await r.text(); let d; try { d = JSON.parse(t) } catch { throw Object.assign(new Error(`HTTP ${r.status}: ${t.slice(0, 120)}`), { status: r.status }) }
    if (!r.ok) throw Object.assign(new Error(d?.error?.message || `HTTP ${r.status}`), { status: r.status });
    return d.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') ?? '';
  }
  const body = { model: modelo, temperature: temperatura, messages: [{ role: 'system', content: sistema }, ...mensajes] };
  if (json && (id === 'groq' || id === 'mistral')) body.response_format = { type: 'json_object' };
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${clave}` };
  if (id === 'openrouter') { headers['HTTP-Referer'] = 'https://github.com/radar'; headers['X-Title'] = 'RADAR'; }
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(tiempo) });
  const t = await r.text(); let d; try { d = JSON.parse(t) } catch { throw Object.assign(new Error(`HTTP ${r.status}: ${t.slice(0, 120)}`), { status: r.status }) }
  if (!r.ok) throw Object.assign(new Error(d?.error?.message || JSON.stringify(d).slice(0, 200)), { status: r.status });
  return (d.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

async function llamar(id, sistema, mensajes, { json = false, temperatura = 0.3, tiempo = 60000 } = {}) {
  const p = PROVEEDORES[id];
  const clave = env(p.clave);
  const t0 = Date.now();
  const modelos = (await modelosVigentes(id, clave)).slice(0, 6);
  const urls = p.urls || [null];
  let ultimoError = '';
  for (const modelo of modelos) {
    for (const url of urls) {
      try {
        const texto = await intentar(id, modelo, url, clave, sistema, mensajes, json, temperatura, tiempo);
        if (texto) return { proveedor: id, nombre: p.nombre, modelo, texto, ms: Date.now() - t0 };
        ultimoError = 'respuesta vacía';
      } catch (e) {
        ultimoError = e.message;
        if (e.status === 401) return { proveedor: id, nombre: p.nombre, modelo, error: 'clave inválida', ms: Date.now() - t0 };
      }
      if (Date.now() - t0 > tiempo * 2) break;
    }
  }
  return { proveedor: id, nombre: p.nombre, modelo: modelos[0], error: ultimoError.slice(0, 200), ms: Date.now() - t0 };
}

// Consulta todas las IA activas en paralelo
export async function consultarTodas(sistema, mensajes, opciones = {}) {
  const ids = proveedoresActivos(opciones.proveedores);
  if (!ids.length) return [];
  return Promise.all(ids.map(id => llamar(id, sistema, mensajes, opciones)));
}

// Extrae JSON aunque la IA lo envuelva en texto o en bloque ```json
export function extraerJSON(texto) {
  if (!texto) return null;
  try { return JSON.parse(texto); } catch {}
  const bloque = texto.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (bloque) { try { return JSON.parse(bloque[1]); } catch {} }
  const ini = texto.indexOf('{'), fin = texto.lastIndexOf('}');
  if (ini >= 0 && fin > ini) { try { return JSON.parse(texto.slice(ini, fin + 1)); } catch {} }
  return null;
}

// Síntesis: una IA (la de mejor historial) redacta una respuesta única a partir de todas las demás.
export async function sintetizar(pregunta, respuestas, pesos = {}, sistema = '') {
  const validas = respuestas.filter(r => r.texto);
  if (validas.length <= 1) return validas[0]?.texto ?? null;
  const orden = [...validas].sort((a, b) => (pesos[b.proveedor] ?? 1) - (pesos[a.proveedor] ?? 1));
  const juez = orden[0].proveedor;
  const material = validas.map(r => `### ${r.nombre} (confiabilidad ${(pesos[r.proveedor] ?? 1).toFixed(2)})\n${r.texto}`).join('\n\n');
  const res = await llamar(juez, sistema ||
    'Usted es un asesor que combina las opiniones de varios expertos. Responda en español, en tono formal y sencillo, sin modismos. ' +
    'Señale en qué coinciden, dónde discrepan y cuál es la conclusión más sólida. Si una afirmación no está respaldada, no la incluya.',
    [{ role: 'user', content: `Pregunta: ${pregunta}\n\nRespuestas de los expertos:\n\n${material}\n\nRedacte la mejor respuesta final.` }]);
  return res.texto ?? orden[0].texto;
}
