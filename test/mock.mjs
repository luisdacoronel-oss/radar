// Respuestas simuladas para probar RADAR sin gastar consultas reales (solo se usa con MOCK=1).
let n = 0;
export async function respuesta(prompt) {
  n++;
  const j = o => ({ text: '```json\n' + JSON.stringify(o) + '\n```', fuentes: [{ titulo: 'Mercado Libre', url: 'https://listado.mercadolibre.com.ar/x' }], web: true, model: 'simulado' });
  if (/productos DISTINTOS/.test(prompt)) return j([{ producto: 'Producto de prueba ' + Math.random().toString(36).slice(2,6), motivo: '+5mil vendidos' }, { producto: 'Otro producto ' + Math.random().toString(36).slice(2,6), motivo: '+1000 vendidos' }, { producto: 'Tercero ' + n, motivo: 'x' }]);
  if (/MINUCIOSO/.test(prompt)) {
    const nombre = (prompt.match(/producto "([^"]+)"/) || [])[1] || 'Producto';
    const bueno = n % 2 === 0 && !/Smartwatch Xiaomi/.test(nombre);
    return j({ nombre, categoria: 'Hogar', imagen_url: 'https://http2.mlstatic.com/D_NQ_NP_prueba.jpg', fuente_principal: { plataforma: 'Mercado Libre', url: 'https://articulo.mercadolibre.com.ar/MLA-123' },
      peso_kg: 0.8, costo_proveedor_usd: bueno ? 1.6 : 9, precio_venta_sugerido_ars: 42999, precio_venta_web_ars: 45999,
      proveedores: [{ proveedor: 'Fábrica Yiwu', plataforma: '1688', tipo: 'internacional', precio_usd: bueno ? 1.6 : 9, moq: 100, url: 'https://detail.1688.com/x' }, { proveedor: 'Mayorista Once', plataforma: 'local', tipo: 'local', precio_ars: bueno ? 8000 : 30000, url: 'https://mayorista.com.ar' }],
      precios_mercados: [{ mercado: 'Argentina - Mercado Libre', precio: 42999, moneda: 'ARS', vendidos: '+5mil vendidos', url: 'https://articulo.mercadolibre.com.ar/MLA-123' }, { mercado: 'Amazon', precio: 24, moneda: 'USD', vendidos: '2K+ comprados', url: 'https://amazon.com/dp/x' }],
      demanda: { nivel: 'alta', puntaje: 88, ventas_comprobadas: true, unidades_vendidas_aprox: 5000, prueba_de_ventas: '+5mil vendidos en ML', meses_pico: ['noviembre', 'diciembre'], busquedas: 'búsquedas en alza' },
      competencia: { nivel: 'media', puntaje: 45, como_diferenciarse: 'kit x2' }, riesgos_regulatorios: ['ninguno'], por_que_si: ['Demanda alta'], por_que_no: ['Competencia media'],
      maxima_ganancia: ['Vender kit x2 en la web', 'Comprar 300 unidades'], alternativas_mejoradas: [{ nombre: 'Versión premium', mejora: 'mejor material', proveedor: 'Alibaba', url: 'https://alibaba.com/x', costo_usd: 3, precio_web_sugerido_ars: 59999 }],
      plan_venta: { titulo_ml: 'Título', web: 'Landing con video' }, plan_publicidad: { meta_ads: 'Video corto' }, ventas_estimadas_mes: { esperado: 80 }, resumen: 'Producto con buena salida.' });
  }
  if (/MÁS VENDIDOS de Mercado Libre/.test(prompt)) return j({ productos: [{ producto: 'Smartwatch Xiaomi Redmi Watch 5 Lite ' + n, vendidos: '+50mil vendidos', precio_ars: 118999, url: 'https://www.mercadolibre.com.ar/smartwatch/p/MLA12345678' }, { producto: 'Auriculares JBL Tune ' + n, vendidos: '+10mil vendidos', precio_ars: 59999, url: 'https://articulo.mercadolibre.com.ar/MLA-555' }] });
  if (/formas REALES de ganar/.test(prompt)) return j({ alternativas: [
    { tipo: 'equivalente genérico', nombre: 'Smartwatch genérico 1.96" marca blanca', proveedor: 'Fábrica Shenzhen', plataforma: 'Alibaba', origen: 'internacional', url: 'https://www.alibaba.com/product-detail/x_1.html', precio_usd: 6.5, moq: 50, peso_kg: 0.15, precio_venta_ars: 45999, precio_venta_web_ars: 49999, por_que: 'Mismas funciones a un tercio del precio', riesgos: ['Garantía propia'] },
    { tipo: 'accesorio', nombre: 'Malla de silicona compatible x3', proveedor: 'Tienda AliExpress', plataforma: 'AliExpress', origen: 'internacional', url: 'https://www.aliexpress.com/item/1005001.html', precio_usd: 0.9, moq: 10, peso_kg: 0.05, precio_venta_ars: 12999, precio_venta_web_ars: 14999, por_que: 'Los compradores cambian la malla', riesgos: [] },
    { tipo: 'proveedor más barato', nombre: 'Redmi Watch 5 Lite original por mayor', proveedor: 'Importador Once', plataforma: 'local', origen: 'local', url: 'https://ejemplo.com.ar/producto/redmi', precio_ars: 98000, moq: 10, peso_kg: 0.2, precio_venta_ars: 118999, precio_venta_web_ars: 119999, por_que: 'Mismo producto', riesgos: ['Margen chico'] }] });
  if (/videos de YouTube recientes/.test(prompt)) return j({ videos: [{ titulo: 'Video de prueba', canal: 'Canal', url: 'https://www.youtube.com/watch?v=abc' }] });
  if (/"lecciones"/.test(prompt) || /enseñanzas/.test(prompt)) return j({ lecciones: [{ titulo: 'Lección ' + n, contenido: 'Contenido práctico', confianza: 4 }] });
  if (/"reglas"/.test(prompt)) return j({ reglas: [1, 2, 3, 4].map(i => ({ titulo: 'Regla ' + i, contenido: 'Hacer X', confianza: 4 })) });
  if (/tasas y rendimientos/.test(prompt)) return j({ resumen: 'Tasas de prueba', opciones: [{ nombre: 'Plazo fijo', rendimiento_aprox: 'TNA 30%', riesgo: 'bajo', liquidez: '30 días', como_empezar: 'Home banking' }], estrategia_sugerida: '60% stock, 20% liquidez, 20% inversión' });
  if (/auto-mejorando/.test(prompt)) {
    const actual = prompt.match(/```js\n([\s\S]*?)```/)[1];
    const nuevo = '// CAMBIOS: Priorizo cocina y mascotas porque dieron más aprobados.\n' + actual.replace(/export const VERSION = \d+;/, 'export const VERSION = 2;').replace("'hogar y organización', 'cocina', 'mascotas'", "'cocina', 'mascotas', 'hogar y organización'");
    return { text: '```js\n' + nuevo + '```', fuentes: [], web: false, model: 'simulado' };
  }
  return { text: '## Informe\nTodo en orden.', fuentes: [], web: false, model: 'simulado' };
}
