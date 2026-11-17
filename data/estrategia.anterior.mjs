// CAMBIOS: Prioricé categorías con mayor margen de ganancia neta comprobada como herramientas automotrices de especialidad, instrumental de medición, audio para creadores y bazar técnico, elevando el piso de precio a $60.000.
// ESTRATEGIA DE RADAR — este archivo lo reescribe RADAR solo, una vez por día, según sus resultados.
// Antes de reemplazarlo lo prueba (test/prueba.mjs). Si la versión nueva falla, se queda con la anterior.
export const VERSION = 6;

// Categorías donde buscar primero (ordenadas por tasa de aprobación y margen neto comprobado).
export const categorias = [
  'herramientas especializadas y diagnóstico automotor',
  'instrumental de medición y diagnóstico técnico',
  'equipamiento de audio y video para creadores de contenido',
  'bazar de especialidad, cafetería y tecnología gastronómica',
  'herramientas de carpintería, construcción e instalación',
  'energía renovable portátil, outdoor y movilidad eléctrica',
  'herramientas de jardinería técnica y mantenimiento',
  'cuidado, bienestar y accesorios técnicos para mascotas',
  'artículos de puericultura, higiene y desarrollo infantil',
  'soluciones de carga rápida y accesorios móviles de alta gama'
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
2. Peso menor a 3 kg y volumen moderado para mantener costos de transporte e importación bajos.
3. Precio de venta al público en Argentina igual o superior a $60.000.
4. Costo de proveedor en origen que represente como máximo el 20% al 25% del precio final de venta.
5. Ausencia de trámites de homologación complejos (como ANMAT o licencias de marcas registradas).
6. Ventas comprobables en plataformas de origen o mercado local con datos concretos. Mes de análisis: ${ctx.mes}. Base acumulada de aprobados: ${cantidadAprobados}.`;
}
