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
