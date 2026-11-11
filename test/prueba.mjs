// Pruebas que tiene que pasar cualquier versión nueva de lib/estrategia.mjs antes de usarse.
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const PROHIBIDO = /\b(import|require|fetch|process|eval|Function|globalThis|child_process|XMLHttpRequest|WebSocket|setTimeout|setInterval|Buffer|fs|http|https|net|crypto)\b|while\s*\(\s*true/;

export async function validarEstrategia(ruta) {
  const codigo = fs.readFileSync(ruta, 'utf8');
  const sinComentarios = codigo.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  if (PROHIBIDO.test(sinComentarios)) throw new Error('usa funciones no permitidas');
  if (codigo.length > 20000) throw new Error('demasiado largo');
  const m = await import(pathToFileURL(ruta).href + '?v=' + Date.now());
  const listas = ['categorias', 'temas', 'temasVideo'];
  for (const l of listas) {
    if (!Array.isArray(m[l]) || m[l].length < (l === 'categorias' ? 8 : 3) || m[l].length > 40 || !m[l].every(x => typeof x === 'string' && x.length > 2 && x.length < 200)) throw new Error('lista inválida: ' + l);
  }
  if (!Number.isInteger(m.productosPorVuelta) || m.productosPorVuelta < 3 || m.productosPorVuelta > 6) throw new Error('productosPorVuelta inválido');
  if (typeof m.instruccionesBusqueda !== 'function') throw new Error('falta instruccionesBusqueda');
  for (let v = 0; v < 15; v++) {
    const t = m.instruccionesBusqueda({ vuelta: v, mes: 'noviembre', aprobados: [], descartados: [] });
    if (typeof t !== 'string' || t.length < 20 || t.length > 3000) throw new Error('instruccionesBusqueda devuelve algo inválido');
  }
  if (!Number.isFinite(m.VERSION)) throw new Error('falta VERSION');
  return true;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ruta = process.argv[2] || new URL('../lib/estrategia.mjs', import.meta.url).pathname;
  validarEstrategia(ruta).then(() => console.log('✅ estrategia válida')).catch(e => { console.error('❌', e.message); process.exit(1) });
}
