// CAMBIOS: Priorizo cocina y mascotas porque dieron más aprobados.
// CAMBIOS: Priorizo cocina y mascotas porque dieron más aprobados.
// CAMBIOS: Priorizo cocina y mascotas porque dieron más aprobados.
// ESTRATEGIA DE RADAR — este archivo lo reescribe RADAR solo, una vez por día, según sus resultados.
// Antes de reemplazarlo lo prueba (test/prueba.mjs). Si la versión nueva falla, se queda con la anterior.
export const VERSION = 2;

// Categorías donde buscar primero (se reordenan según lo que dio productos aprobados).
export const categorias = [
  'cocina', 'mascotas', 'hogar y organización', 'herramientas y auto', 'deportes y fitness',
  'belleza y cuidado personal', 'bebés y niños', 'tecnología y accesorios', 'jardín y exterior', 'regalos y temporada', 'herramientas y accesorios para auto', 'oficina y escolar'
];

// Temas que RADAR estudia por su cuenta.
export const temas = [
  'estrategias ingeniosas de ventas que funcionan hoy', 'posicionamiento de publicaciones en Mercado Libre Argentina',
  'cómo hacer campañas de Mercado Ads rentables', 'Meta Ads para tiendas online en Argentina', 'cómo vender en una tienda propia y conseguir tráfico',
  'psicología de ventas y persuasión en e-commerce', 'fijación de precios, kits y ventas cruzadas', 'WhatsApp Business para cerrar ventas',
  'gestión de capital y flujo de caja para revendedores', 'importar por courier y formal a Argentina: costos y trámites',
  'tendencias de consumo y productos de temporada en Argentina', 'mercado de acciones, CEDEARs y bonos en Argentina'
];

// Temas para buscar videos de YouTube y aprender de ellos.
export const temasVideo = [
  'estrategias de venta en Mercado Libre Argentina', 'productos ganadores para importar y revender',
  'publicidad rentable en Meta Ads para e-commerce', 'cómo vender más en una tienda online propia',
  'gestión de capital para emprendedores', 'inversiones en Argentina: CEDEARs, bonos y plazo fijo'
];

// Cuántos productos nuevos explora en cada vuelta automática (cada hora).
export const productosPorVuelta = 4;

// Instrucciones extra para la búsqueda de productos.
export function instruccionesBusqueda(ctx) {
  const cat = categorias[(ctx.vuelta || 0) % categorias.length];
  return `Esta vez concentrate sobre todo en la categoría "${cat}". Priorizá productos de precio medio o alto (más de $35.000), kits o combos, livianos, con más de 1000 unidades vendidas y proveedor barato. Tené en cuenta la temporada actual en Argentina (${ctx.mes}).`;
}
