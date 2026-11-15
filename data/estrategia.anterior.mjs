// CAMBIOS: Ajusté las categorías para priorizar tecnología móvil, herramientas de diagnóstico avanzado, cuidado personal y bebés con alta rotación.
// ESTRATEGIA DE RADAR — este archivo lo reescribe RADAR solo, una vez por día, según sus resultados.
// Antes de reemplazarlo lo prueba (test/prueba.mjs). Si la versión nueva falla, se queda con la anterior.
export const VERSION = 4;

// Categorías donde buscar primero (se reordenan según lo que dio productos aprobados).
export const categorias = [
  'tecnología y accesorios para celulares',
  'herramientas y diagnóstico automotor',
  'bebés y maternidad',
  'belleza y cuidado personal',
  'herramientas e instrumentos de medición',
  'mascotas y accesorios',
  'hogar y organización',
  'deportes, fitness y aire libre',
  'cocina y bazar',
  'fotografía, audio y video'
];

// Temas que RADAR estudia por su cuenta.
export const temas = [
  'estrategias de ventas e-commerce en Mercado Libre Argentina',
  'búsqueda y validación de productos ganadores importados',
  'configuración de campañas rentables en Meta Ads',
  'optimización de anuncios en Mercado Ads',
  'psicología de ventas y combos de alto valor percibido',
  'estrategias de fijación de precios y márgenes netos',
  'cierre de ventas por WhatsApp Business',
  'importación por courier formal en Argentina',
  'gestión de flujo de caja para revendedores',
  'tendencias de consumo en el mercado argentino'
];

// Temas para buscar videos de YouTube y aprender de ellos.
export const temasVideo = [
  'productos ganadores para revender en Mercado Libre Argentina',
  'cómo crear combos rentables en e-commerce',
  'campañas de publicidad eficientes en Meta Ads',
  'técnicas de importación simplificada para emprendedores',
  'optimización de conversión en tiendas online propias'
];

// Cuántos productos nuevos explora en cada vuelta automática (cada hora).
export const productosPorVuelta = 5;

// Instrucciones extra para la búsqueda de productos.
export function instruccionesBusqueda(ctx) {
  const cat = categorias[(ctx.vuelta || 0) % categorias.length];
  return `Esta vez concentrate sobre todo en la categoría "${cat}". Priorizá productos en formato de kit o combo, livianos, de bajo volumen, de precio medio o alto (más de $35.000), con proveedor accesible en dólares y ventas comprobadas. Tené en cuenta la temporada actual en Argentina (${ctx.mes}).`;
}
