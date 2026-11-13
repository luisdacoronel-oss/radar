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

export const PROVEEDORES = {
  github: {
    nombre: 'GitHub Models', clave: 'GITHUB_TOKEN', modelo: () => env('GITHUB_MODEL', 'openai/gpt-4.1-mini'),
    url: 'https://models.github.ai/inference/chat/completions', tipo: 'openai',
  },
  gemini: {
    nombre: 'Google Gemini', clave: 'GEMINI_API_KEY', modelo: () => env('GEMINI_MODEL', 'gemini-2.5-flash'), tipo: 'gemini',
  },
  groq: {
    nombre: 'Groq (Llama)', clave: 'GROQ_API_KEY', modelo: () => env('GROQ_MODEL', 'llama-3.3-70b-versatile'),
    url: 'https://api.groq.com/openai/v1/chat/completions', tipo: 'openai',
  },
  openrouter: {
    nombre: 'OpenRouter', clave: 'OPENROUTER_API_KEY', modelo: () => env('OPENROUTER_MODEL', 'meta-llama/llama-3.3-70b-instruct:free'),
    url: 'https://openrouter.ai/api/v1/chat/completions', tipo: 'openai',
  },
  mistral: {
    nombre: 'Mistral', clave: 'MISTRAL_API_KEY', modelo: () => env('MISTRAL_MODEL', 'mistral-small-latest'),
    url: 'https://api.mistral.ai/v1/chat/completions', tipo: 'openai',
  },
  cerebras: {
    nombre: 'Cerebras', clave: 'CEREBRAS_API_KEY', modelo: () => env('CEREBRAS_MODEL', 'llama-3.3-70b'),
    url: 'https://api.cerebras.ai/v1/chat/completions', tipo: 'openai',
  },
};

export function proveedoresActivos(lista = Object.keys(PROVEEDORES)) {
  return lista.filter(id => PROVEEDORES[id] && env(PROVEEDORES[id].clave));
}

async function llamar(id, sistema, mensajes, { json = false, temperatura = 0.3, tiempo = 60000 } = {}) {
  const p = PROVEEDORES[id];
  const clave = env(p.clave);
  const modelo = p.modelo();
  const t0 = Date.now();
  try {
    let texto;
    if (p.tipo === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${clave}`;
      const body = {
        systemInstruction: { parts: [{ text: sistema }] },
        contents: mensajes.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { temperature: temperatura, ...(json ? { responseMimeType: 'application/json' } : {}) },
      };
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(tiempo) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message || `HTTP ${r.status}`);
      texto = d.candidates?.[0]?.content?.parts?.map(x => x.text).join('') ?? '';
    } else {
      const body = { model: modelo, temperature: temperatura, messages: [{ role: 'system', content: sistema }, ...mensajes] };
      if (json && id !== 'openrouter' && id !== 'github') body.response_format = { type: 'json_object' };
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${clave}` };
      if (id === 'openrouter') { headers['HTTP-Referer'] = 'https://github.com/radar'; headers['X-Title'] = 'RADAR'; }
      const r = await fetch(p.url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(tiempo) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message || JSON.stringify(d).slice(0, 200));
      texto = d.choices?.[0]?.message?.content ?? '';
    }
    return { proveedor: id, nombre: p.nombre, modelo, texto, ms: Date.now() - t0 };
  } catch (e) {
    return { proveedor: id, nombre: p.nombre, modelo, error: e.message, ms: Date.now() - t0 };
  }
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
