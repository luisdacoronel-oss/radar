// RADAR · Inversiones — Indicadores técnicos
// Media móvil simple y exponencial, RSI (Wilder), Fibonacci (retroceso y extensión)
// y una lectura de señales en lenguaje claro.

export function sma(valores, periodo) {
  const out = new Array(valores.length).fill(null);
  let suma = 0;
  for (let i = 0; i < valores.length; i++) {
    suma += valores[i];
    if (i >= periodo) suma -= valores[i - periodo];
    if (i >= periodo - 1) out[i] = suma / periodo;
  }
  return out;
}

export function ema(valores, periodo) {
  const out = new Array(valores.length).fill(null);
  const k = 2 / (periodo + 1);
  let prev = null;
  for (let i = 0; i < valores.length; i++) {
    if (i === periodo - 1) {
      prev = valores.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;
      out[i] = prev;
    } else if (i >= periodo) {
      prev = valores[i] * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

// RSI de Wilder, período 14 por defecto
export function rsi(valores, periodo = 14) {
  const out = new Array(valores.length).fill(null);
  if (valores.length <= periodo) return out;
  let ganancia = 0, perdida = 0;
  for (let i = 1; i <= periodo; i++) {
    const d = valores[i] - valores[i - 1];
    if (d >= 0) ganancia += d; else perdida -= d;
  }
  ganancia /= periodo; perdida /= periodo;
  out[periodo] = perdida === 0 ? 100 : 100 - 100 / (1 + ganancia / perdida);
  for (let i = periodo + 1; i < valores.length; i++) {
    const d = valores[i] - valores[i - 1];
    ganancia = (ganancia * (periodo - 1) + Math.max(d, 0)) / periodo;
    perdida = (perdida * (periodo - 1) + Math.max(-d, 0)) / periodo;
    out[i] = perdida === 0 ? 100 : 100 - 100 / (1 + ganancia / perdida);
  }
  return out;
}

// Fibonacci sobre el último gran movimiento (tramo) de la ventana indicada.
// Si el máximo es posterior al mínimo, el tramo es alcista: el retroceso se mide hacia abajo
// desde el máximo y la extensión proyecta por encima del máximo. Si es bajista, al revés.
export function fibonacci(velas, ventana = 120) {
  const tramo = velas.slice(-ventana);
  if (tramo.length < 10) return null;
  let iMax = 0, iMin = 0;
  tramo.forEach((v, i) => {
    if (v.high > tramo[iMax].high) iMax = i;
    if (v.low < tramo[iMin].low) iMin = i;
  });
  const max = tramo[iMax].high, min = tramo[iMin].low, rango = max - min;
  const alcista = iMax > iMin;
  const RET = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const EXT = [1.272, 1.618, 2.0, 2.618];
  const retroceso = RET.map(n => ({ nivel: n, precio: alcista ? max - rango * n : min + rango * n }));
  const extension = EXT.map(n => ({ nivel: n, precio: alcista ? min + rango * n : max - rango * n }));
  return {
    tendenciaTramo: alcista ? 'alcista' : 'bajista',
    desde: { fecha: tramo[alcista ? iMin : iMax].time, precio: alcista ? min : max },
    hasta: { fecha: tramo[alcista ? iMax : iMin].time, precio: alcista ? max : min },
    retroceso, extension,
  };
}

const ultimo = arr => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]; return null; };

// Lectura de señales: devuelve puntaje (-100 a +100) y explicación en tono formal y sencillo
export function leerSenales(velas) {
  const cierres = velas.map(v => v.close);
  const precio = cierres.at(-1);
  const m20 = sma(cierres, 20), m50 = sma(cierres, 50), m200 = sma(cierres, 200);
  const r = rsi(cierres, 14);
  const fib = fibonacci(velas);
  const senales = [];
  let puntaje = 0;
  const add = (clave, peso, texto) => { senales.push({ clave, peso, texto }); puntaje += peso; };

  const a20 = ultimo(m20), a50 = ultimo(m50), a200 = ultimo(m200), aRsi = ultimo(r);

  if (a50 != null && a200 != null) {
    const prev50 = m50.at(-6), prev200 = m200.at(-6);
    if (prev50 != null && prev200 != null && prev50 < prev200 && a50 > a200)
      add('cruce_dorado', 25, 'La media de 50 días cruzó hacia arriba la de 200 (cruce dorado): señal alcista de mediano plazo.');
    else if (prev50 != null && prev200 != null && prev50 > prev200 && a50 < a200)
      add('cruce_muerte', -25, 'La media de 50 días cruzó hacia abajo la de 200: señal bajista de mediano plazo.');
    else if (a50 > a200) add('tendencia_alcista', 10, 'La media de 50 está por encima de la de 200: tendencia de fondo alcista.');
    else add('tendencia_bajista', -10, 'La media de 50 está por debajo de la de 200: tendencia de fondo bajista.');
  }
  if (a20 != null) {
    if (precio > a20) add('sobre_m20', 5, 'El precio está por encima de su media de 20 días.');
    else add('bajo_m20', -5, 'El precio está por debajo de su media de 20 días.');
  }
  if (aRsi != null) {
    if (aRsi < 30) add('rsi_sobreventa', 20, `RSI en ${aRsi.toFixed(0)}: zona de sobreventa, posible rebote.`);
    else if (aRsi > 70) add('rsi_sobrecompra', -20, `RSI en ${aRsi.toFixed(0)}: zona de sobrecompra, posible corrección.`);
    else add('rsi_neutral', 0, `RSI en ${aRsi.toFixed(0)}: zona neutral.`);
  }
  if (fib) {
    const cerca = fib.retroceso.find(n => n.nivel > 0 && n.nivel < 1 && Math.abs(precio - n.precio) / precio < 0.015);
    if (cerca) {
      const peso = fib.tendenciaTramo === 'alcista' ? 15 : -15;
      add(fib.tendenciaTramo === 'alcista' ? 'fib_soporte' : 'fib_resistencia', peso,
        `El precio está sobre el retroceso de Fibonacci ${(cerca.nivel * 100).toFixed(1)}% (${cerca.precio.toFixed(2)}), ` +
        (fib.tendenciaTramo === 'alcista' ? 'que suele actuar como soporte.' : 'que suele actuar como resistencia.'));
    }
    const objetivo = fib.extension[0];
    senales.push({ clave: 'fib_objetivo', peso: 0, texto: `Objetivo por extensión de Fibonacci 127,2%: ${objetivo.precio.toFixed(2)}.` });
  }
  puntaje = Math.max(-100, Math.min(100, puntaje));
  const accion = puntaje >= 30 ? 'COMPRAR' : puntaje <= -30 ? 'VENDER' : 'ESPERAR';
  return {
    precio, puntaje, accion,
    m20: a20, m50: a50, m200: a200, rsi: aRsi,
    fibonacci: fib, senales,
    series: { m20, m50, m200, rsi: r },
  };
}

// ---------- Ficha del activo: variaciones, volatilidad, riesgo, soportes/resistencias y escenarios ----------
export function ficha(velas, fib) {
  const c = velas.map(v => v.close), p = c.at(-1);
  const varN = n => c.length > n ? +((p / c.at(-1 - n) - 1) * 100).toFixed(2) : null;
  const rets = c.slice(-61).map((x, i, a) => i ? Math.log(x / a[i - 1]) : null).filter(x => x != null);
  const media = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const vol = Math.sqrt(rets.reduce((a, b) => a + (b - media) ** 2, 0) / Math.max(1, rets.length - 1)) * Math.sqrt(252) * 100;
  const riesgo = vol < 15 ? 'Bajo' : vol < 30 ? 'Medio' : vol < 55 ? 'Alto' : 'Muy alto';
  // pivotes: mínimos y máximos locales de los últimos 6 meses (ventana de 5 ruedas a cada lado)
  const t = velas.slice(-130), piv = { bajos: [], altos: [] };
  for (let i = 5; i < t.length - 5; i++) {
    const ventana = t.slice(i - 5, i + 6);
    if (t[i].low === Math.min(...ventana.map(v => v.low))) piv.bajos.push(t[i].low);
    if (t[i].high === Math.max(...ventana.map(v => v.high))) piv.altos.push(t[i].high);
  }
  const agrupar = arr => arr.sort((a, b) => a - b).reduce((g, x) => { const u = g.at(-1); if (u && Math.abs(x - u.v) / u.v < 0.02) { u.v = (u.v * u.n + x) / (u.n + 1); u.n++ } else g.push({ v: x, n: 1 }); return g }, []);
  const soportes = agrupar(piv.bajos.concat(piv.altos)).filter(g => g.v < p * 0.995).sort((a, b) => b.v - a.v).slice(0, 3).map(g => +g.v.toFixed(4));
  const resistencias = agrupar(piv.altos.concat(piv.bajos)).filter(g => g.v > p * 1.005).sort((a, b) => a.v - b.v).slice(0, 3).map(g => +g.v.toFixed(4));
  const vol20 = velas.slice(-20).reduce((a, v) => a + (v.volume || 0), 0) / 20;
  const mov = p * vol / 100 * Math.sqrt(63 / 252); // movimiento típico en ~3 meses
  const ext = fib?.extension?.[0]?.precio;
  const escenarios = {
    horizonte: '1 a 3 meses',
    alcista: +(resistencias[0] && ext ? Math.max(resistencias[0], Math.min(ext, p + mov * 1.5)) : p + mov).toFixed(4),
    neutral: [+(p - mov * 0.4).toFixed(4), +(p + mov * 0.4).toFixed(4)],
    bajista: +(soportes[0] ? Math.min(soportes[0], p - mov * 0.5) : p - mov).toFixed(4),
  };
  return { var1d: varN(1), var1s: varN(5), var1m: varN(21), var1a: varN(252), volatilidadAnualPct: +vol.toFixed(1), riesgo, soportes, resistencias, volumenPromedio20: Math.round(vol20), escenarios };
}
