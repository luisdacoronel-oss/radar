// RADAR · Aprendizaje
// Guarda cada recomendación con el precio del momento. Pasados 5 y 20 días compara con el precio real
// y anota si acertó. Con eso calcula la confiabilidad de cada IA y de cada señal técnica, y la usa
// para ponderar las próximas decisiones. Cuanto más tiempo funciona, mejor calibra.

const UMBRAL = 0.01; // 1 % de movimiento para considerar acierto en COMPRAR/VENDER

function acierto(accion, rendimiento) {
  if (accion === 'COMPRAR') return rendimiento > UMBRAL;
  if (accion === 'VENDER') return rendimiento < -UMBRAL;
  if (accion === 'ESPERAR') return Math.abs(rendimiento) <= 0.03;
  return null;
}

// Laplace: arranca en 1,0 (neutral) y se mueve entre 0 y 2 según los aciertos
const peso = s => s ? 2 * (s.aciertos + 1) / (s.total + 2) : 1;

export function registrar(historial, fecha, analisisActivos, votosIA) {
  const dia = fecha.slice(0, 10);
  for (const a of analisisActivos) {
    if (a.precio == null) continue;
    const id = `${dia}|${a.yahoo}`;
    const votos = {};
    for (const [prov, lista] of Object.entries(votosIA)) {
      const v = lista.find(x => x.yahoo === a.yahoo || x.nombre === a.nombre);
      if (v?.accion) votos[prov] = v.accion;
    }
    const entrada = {
      id, fecha: dia, yahoo: a.yahoo, nombre: a.nombre, precio: a.precio,
      tecnico: a.accion, senales: a.senales.filter(s => s.peso !== 0).map(s => s.clave), votos,
      evaluado: historial.find(h => h.id === id)?.evaluado ?? {},
    };
    const i = historial.findIndex(h => h.id === id);
    if (i >= 0) historial[i] = entrada; else historial.push(entrada); // una entrada por activo y por día
  }
  // conservar hasta 3 años
  const limite = new Date(Date.now() - 1100 * 864e5).toISOString().slice(0, 10);
  return historial.filter(h => h.fecha >= limite);
}

export function evaluar(historial, velasPorActivo, horizontes, estado) {
  estado.proveedores ??= {}; estado.senales ??= {}; estado.tecnico ??= { aciertos: 0, total: 0 };
  let nuevas = 0;
  for (const h of historial) {
    const velas = velasPorActivo[h.yahoo];
    if (!velas?.length) continue;
    const idx = velas.findIndex(v => v.time >= h.fecha);
    if (idx < 0) continue;
    for (const dias of horizontes) {
      if (h.evaluado[dias]) continue;
      const fut = velas[idx + dias];
      if (!fut) continue;
      const r = fut.close / h.precio - 1;
      h.evaluado[dias] = { rendimiento: r };
      nuevas++;
      const sumar = (obj, clave, ok) => { if (ok == null) return; obj[clave] ??= { aciertos: 0, total: 0 }; obj[clave].total++; if (ok) obj[clave].aciertos++; };
      for (const [prov, acc] of Object.entries(h.votos)) sumar(estado.proveedores, prov, acierto(acc, r));
      const okTec = acierto(h.tecnico, r);
      if (okTec != null) { estado.tecnico.total++; if (okTec) estado.tecnico.aciertos++; }
      // una señal "acierta" si su signo coincide con la dirección del precio
      for (const s of h.senales) {
        const alcista = /dorado|alcista|sobre_m20|sobreventa|soporte/.test(s);
        sumar(estado.senales, s, alcista ? r > 0 : r < 0);
      }
    }
  }
  estado.actualizado = new Date().toISOString();
  return nuevas;
}

export function pesos(estado) {
  const prov = {}, sen = {};
  for (const [k, s] of Object.entries(estado.proveedores ?? {})) prov[k] = peso(s);
  for (const [k, s] of Object.entries(estado.senales ?? {})) sen[k] = peso(s);
  return { proveedores: prov, senales: sen, tecnico: peso(estado.tecnico) };
}

// Decisión final ponderada: IAs + análisis técnico (cada uno vale según su historial)
export function consenso(activo, votos, pesosActuales) {
  const tabla = { COMPRAR: 0, VENDER: 0, ESPERAR: 0 };
  const detalle = [];
  for (const [prov, acc] of Object.entries(votos)) {
    if (!tabla.hasOwnProperty(acc)) continue;
    const w = pesosActuales.proveedores[prov] ?? 1;
    tabla[acc] += w; detalle.push({ quien: prov, accion: acc, peso: w });
  }
  const wT = pesosActuales.tecnico ?? 1;
  tabla[activo.accion] += wT; detalle.push({ quien: 'tecnico', accion: activo.accion, peso: wT });
  const total = Object.values(tabla).reduce((a, b) => a + b, 0) || 1;
  const [accion, w] = Object.entries(tabla).sort((a, b) => b[1] - a[1])[0];
  return { accion, acuerdo: w / total, detalle };
}
