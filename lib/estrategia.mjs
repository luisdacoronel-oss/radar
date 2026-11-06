// CAMBIOS: Se ajustaron las instrucciones para priorizar productos por encima de $50.000 con alta rotación y mejor margen neto.
export const VERSION = 2;

// Categorías donde buscar primero (se reordenan según lo que dio productos aprobados).
export const categorias = [
  'mascotas', 'herramientas y auto', 'deportes y fitness', 'hogar y organización', 'cocina',
  'belleza y cuidado personal', 'bebés y niños', 'tecnología y accesorios', 'jardín y exterior', 'regalos y temporada'
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
export const productosPorVuelta = 2;

// Instrucciones extra para la búsqueda de productos.
export function instruccionesBusqueda(ctx) {
  const cat = categorias[(ctx.vuelta || 0) % categorias.length];
  return `Esta vez concentrate en la categoría "${cat}". Buscá productos de precio superior a $50.000, enfocados en kits, combos o artículos livianos con alta demanda demostrada y bajo costo de reposición. Considerá el contexto económico actual de Argentina (${ctx.mes}).`;
}
