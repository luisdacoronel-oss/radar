// CAMBIOS: Incrementé la versión a 12, reordené las categorías priorizando instrumental eléctrico, climatización y herramientas automotrices, y refiné las instrucciones para maximizar el margen neto.
// ESTRATEGIA DE RADAR — este archivo lo reescribe RADAR solo, una vez por día, según sus resultados.
// Antes de reemplazarlo lo prueba (test/prueba.mjs). Si la versión nueva falla, se queda con la anterior.
export const VERSION = 12;

// Categorías donde buscar primero (ordenadas por tasa de aprobación y margen neto comprobado).
export const categorias = [
  'instrumental de medición eléctrica, ambiental y diagnóstico técnico',
  'herramientas especializadas de diagnóstico automotor y detailing',
  'herramientas de refrigeración, climatización y prueba de presión',
  'herramientas industriales de corte, roscado y biselado de tubos',
  'herramientas para construcción, nivelación láser y colocación de porcelanato',
  'energía solar portátil, iluminación autónoma y estaciones de carga',
  'equipamiento de audio, microfonía y transmisión para creadores',
  'bazar de especialidad, tecnología gastronómica y cafetería de alta gama',
  'combos de consumo masivo de alta rotación y volumen empaquetado',
  'soluciones de seguridad inteligente y automatización para e-commerce'
];

// Temas que RADAR estudia por su cuenta para optimizar la toma de decisiones comerciales.
export const temas = [
  'análisis de landed cost y tributación de importación por courier en Argentina',
  'cálculo de margen neto real en Mercado Libre considerando comisiones y retenciones',
  'detección de nichos desatendidos con alta relación precio sobre peso',
  'estrategias de pricing para tiendas Shopify y Tiendanube con pasarelas locales',
  'armado de combos comerciales para elevar el valor promedio por pedido',
  'optimización de costo por adquisición en Meta Ads para productos técnicos',
  'validación de demanda histórica y volumen de búsqueda en marketplaces',
  'negociación de condiciones con proveedores en origen y control de calidad',
  'gestión de stock crítico y velocidad de rotación de capital de trabajo',
  'estrategias de fidelización y venta recurrente mediante WhatsApp Business'
];

// Temas para buscar videos formativos de YouTube.
export const temasVideo = [
  'cómo calcular costos reales de importación por courier en Argentina',
  'productos ganadores con alta rentabilidad para Mercado Libre',
  'estrategias de armado de combos rentables en e-commerce',
  'campañas publicitarias de conversión directa para tiendas propias',
  'novedades e instrumentos técnicos con alto margen comercial'
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
1. Formato kit o combo completo con maletín, estuche o accesorios, evitando artículos individuales fácilmente comparables.
2. Peso menor a 2.5 kg y volumen moderado para mantener costos de transporte e importación bajos.
3. Precio de venta al público en Argentina igual o superior a $90.000 (o lotes cerrados de alta rotación).
4. Costo de proveedor en origen que represente como máximo el 20% del precio final de venta.
5. Ausencia de trámites de homologación complejos (como ANMAT o ENACOM) y libre de marcas registradas sensibles.
6. Ventas comprobables en plataformas de origen o mercado local con datos concretos. Mes de análisis: ${ctx.mes}. Base acumulada de aprobados: ${cantidadAprobados}.`;
}
