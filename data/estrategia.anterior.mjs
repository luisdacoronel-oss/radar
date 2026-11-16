// CAMBIOS: Reorganicé las categorías priorizando instrumental de diagnóstico automotor, herramientas técnicas y accesorios móviles de alto valor percibido, y reforcé las pautas de búsqueda sobre relación costo-peso.
// ESTRATEGIA DE RADAR — este archivo lo reescribe RADAR solo, una vez por día, según sus resultados.
// Antes de reemplazarlo lo prueba (test/prueba.mjs). Si la versión nueva falla, se queda con la anterior.
export const VERSION = 5;

// Categorías donde buscar primero (ordenadas por tasa de aprobación y margen neto comprobado).
export const categorias = [
  'herramientas y diagnóstico automotor',
  'herramientas especializadas e instrumentos de medición',
  'accesorios para celulares y carga rápida',
  'tecnología y audio para creadores de contenido',
  'cuidado, estética y adiestramiento de mascotas',
  'bebés, primera infancia y maternidad',
  'refrigeración, climatización y plomería técnica',
  'deportes específicos, running y equipamiento outdoor',
  'carpintería, herrajes y soluciones para talleres',
  'pequeños electrodomésticos y bazar técnico funcional'
];

// Temas que RADAR estudia por su cuenta para optimizar la toma de decisiones comerciales.
export const temas = [
  'análisis de landed cost y aranceles de importación por courier en Argentina',
  'detección de productos de alto valor percibido y bajo peso volumétrico',
  'estrategias de pricing para absorber comisiones e impuestos en Mercado Libre',
  'optimización de combos y kits comerciales para elevar el ticket promedio',
  'técnicas de conversión en tiendas online propias sin comisiones de marketplace',
  'segmentación y costos por adquisición en campañas de Meta Ads para e-commerce',
  'validación de demanda real mediante métricas de ventas históricas en marketplaces',
  'negociación de compras mayoristas y control de calidad en origen vía Alibaba',
  'gestión de inventario crítico y rotación de capital para revendedores',
  'estrategias de postventa y fidelización vía WhatsApp Business'
];

// Temas para buscar videos formativos de YouTube.
export const temasVideo = [
  'cómo calcular costos de importación y landed cost en Argentina',
  'productos ganadores con alta rotación para Mercado Libre',
  'estrategias de armado de combos rentables en comercio electrónico',
  'campañas publicitarias de conversión para tiendas Shopify y Tiendanube',
  'herramientas y nichos desatendidos con alto margen de ganancia'
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
1. Formato combo o kit completo con estuche o accesorios, lo que incrementa el valor percibido y reduce la comparación directa.
2. Peso menor a 2,5 kg y volumen compacto para asegurar costos de flete o importación controlados.
3. Precio de venta en Argentina superior a $45.000.
4. Costo de proveedor en origen que represente como máximo el 25% del precio final de venta al público en moneda local.
5. Evitá productos con requerimiento de homologaciones complejas (ANMAT o marcas registradas con licencia exclusiva).
6. Verificá ventas comprobadas con cifras concretas en las plataformas de origen y destino. Considerá el mes de análisis: ${ctx.mes}. Base acumulada de aprobados: ${cantidadAprobados}.`;
}
