// CAMBIOS: Incrementé la versión a 13, prioricé mecatrónica e instrumental de medición industrial, y reordené categorías para aumentar la tasa de productos aprobados con alto margen neto.
// ESTRATEGIA DE RADAR — este archivo lo reescribe RADAR solo, una vez por día, según sus resultados.
// Antes de reemplazarlo lo prueba (test/prueba.mjs). Si la versión nueva falla, se queda con la anterior.
export const VERSION = 13;

// Categorías donde buscar primero (ordenadas por tasa de aprobación y margen neto comprobado).
export const categorias = [
  'instrumental de medición industrial, metrología y diagnóstico eléctrico',
  'herramientas especializadas de diagnóstico automotor, taller y detailing',
  'herramientas de refrigeración, climatización y detección de fugas',
  'herramientas industriales metalúrgicas, roscado, corte y soldadura',
  'herramientas para construcción, nivelación y colocación de porcelanato',
  'equipamiento de audio profesional, streaming, microfonía y podcasting',
  'bazar de especialidad, equipamiento para barista y tecnología gastronómica',
  'energía solar portátil, baterías de litio e iluminación autónoma',
  'combos de consumo masivo, mantenimiento e higiene de alta rotación',
  'sistemas de automatización, control de accesos y seguridad electrónica'
];

// Temas que RADAR estudia por su cuenta para optimizar la toma de decisiones comerciales.
export const temas = [
  'análisis de landed cost y tributación de importación por courier en Argentina',
  'cálculo de margen neto real en Mercado Libre considerando comisiones y retenciones',
  'detección de nichos técnicos con alta relación precio sobre peso',
  'estrategias de pricing para tiendas Shopify y Tiendanube con pasarelas locales',
  'armado de combos y kits de herramientas para elevar el ticket promedio',
  'optimización de costo por adquisición en Meta Ads para productos especializados',
  'validación de demanda histórica y volumen de búsqueda en marketplaces',
  'negociación de condiciones con proveedores en origen y control de calidad',
  'gestión de stock crítico y velocidad de rotación del capital de trabajo',
  'estrategias de fidelización y venta recurrente mediante WhatsApp Business'
];

// Temas para buscar videos formativos de YouTube.
export const temasVideo = [
  'cómo calcular costos reales de importación por courier en Argentina',
  'productos ganadores de alto margen para Mercado Libre Argentina',
  'estrategias de armado de combos rentables para e-commerce',
  'campañas publicitarias de conversión directa para productos técnicos',
  'novedades en herramientas e instrumentos de medición con alto margen'
];

// Cuántos productos nuevos explora en cada vuelta automática (cada hora).
export const productosPorVuelta = 5;

// Instrucciones detalladas para guiar la búsqueda sistemática de oportunidades.
export function instruccionesBusqueda(ctx) {
  const indice = (ctx.vuelta || 0) % categorias.length;
  const categoriaObjetivo = categorias[indice];
  const cantidadAprobados = (ctx.aprobados && ctx.aprobados.length) || 0;

  return `Concentrate en la categoría "${categoriaObjetivo}".
Buscá productos que cumplan estrictamente:
1. Formato kit o combo completo con maletín, estuche o accesorios indispensables, evitando artículos unitarios genéricos.
2. Peso menor a 2.5 kg y volumen moderado para mantener costos logísticos e impositivos reducidos.
3. Precio de venta al público en Argentina igual o superior a $90.000 (o packs cerrados de alta rotación).
4. Costo de proveedor en origen que represente como máximo el 20% del precio final de venta.
5. Libre de trámites de homologación complejos (como ANMAT o ENACOM) y sin marcas registradas sensibles.
6. Ventas comprobables en plataformas de origen o mercado local con datos concretos. Mes de análisis: ${ctx.mes}. Base acumulada de aprobados: ${cantidadAprobados}.`;
}
