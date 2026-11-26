// CAMBIOS: Reordené las categorías según su tasa histórica de conversión, incorporé redes de telecomunicaciones y ajusté los filtros de búsqueda a combos de alto margen.
export const VERSION = 14;

// Categorías donde buscar primero (ordenadas por tasa de aprobación y margen neto comprobado).
export const categorias = [
  'herramientas de refrigeración, climatización y detección de fugas',
  'instrumental de medición industrial, metrología y diagnóstico eléctrico',
  'herramientas especializadas de diagnóstico automotor, taller y detailing',
  'equipamiento de audio profesional, streaming, microfonía y podcasting',
  'combos de consumo masivo, mantenimiento e higiene de alta rotación',
  'sistemas de fibra óptica, redes y herramientas de telecomunicaciones',
  'accesorios para vehículos eléctricos, carga y electrónica automotriz técnica',
  'bazar de especialidad, equipamiento para barista y tecnología gastronómica',
  'herramientas industriales metalúrgicas, roscado, corte y soldadura',
  'herramientas para construcción, nivelación y carpintería'
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
  'selección de productos de alta rotación y excelente margen neto'
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
1. Formato kit o combo completo con maletín, estuche organizador o packs cerrados de alta rotación, evitando unidades sueltas de bajo valor.
2. Peso menor a 2.5 kg y volumen moderado para optimizar costos de envío e importación.
3. Precio de venta al público en Argentina superior a $45.000 ARS.
4. Costo de proveedor en origen que represente como máximo el 25% del precio final de venta.
5. Libre de trámites de homologación complejos (como ANMAT o ENACOM) y sin marcas registradas sensibles.
6. Ventas comprobables en plataformas de origen o mercado local con datos concretos. Mes de análisis: ${ctx.mes}. Base acumulada de aprobados: ${cantidadAprobados}.`;
}
