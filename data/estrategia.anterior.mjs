// CAMBIOS: Se priorizaron herramientas técnicas y accesorios automotrices de alta rotación con precios superiores a $50.000.
export const VERSION = 3;

export const categorias = [
  'herramientas y auto', 'accesorios para vehículos', 'deportes y fitness', 'hogar y organización', 'mascotas',
  'belleza y cuidado personal', 'tecnología y accesorios', 'jardín y exterior', 'regalos y temporada', 'bebés y niños'
];

export const temas = [
  'estrategias ingeniosas de ventas que funcionan hoy', 'posicionamiento de publicaciones en Mercado Libre Argentina',
  'cómo hacer campañas de Mercado Ads rentables', 'Meta Ads para tiendas online en Argentina', 'cómo vender en una tienda propia y conseguir tráfico',
  'psicología de ventas y persuasión en e-commerce', 'fijación de precios, kits y ventas cruzadas', 'WhatsApp Business para cerrar ventas',
  'gestión de capital y flujo de caja para revendedores', 'importar por courier y formal a Argentina: costos y trámites',
  'tendencias de consumo y productos de temporada en Argentina', 'mercado de acciones, CEDEARs y bonos en Argentina'
];

export const temasVideo = [
  'estrategias de venta en Mercado Libre Argentina', 'productos ganadores para importar y revender',
  'publicidad rentable en Meta Ads para e-commerce', 'cómo vender más en una tienda online propia',
  'gestión de capital para emprendedores', 'inversiones en Argentina: CEDEARs, bonos y plazo fijo'
];

export const productosPorVuelta = 2;

export function instruccionesBusqueda(ctx) {
  const cat = categorias[(ctx.vuelta || 0) % categorias.length];
  return `Esta vez concentrate en la categoría "${cat}". Buscá productos de precio superior a $50.000, enfocados en kits técnicos, herramientas manuales especializadas o accesorios de alta demanda comprobada en Mercado Libre Argentina. Considerá el contexto económico actual de Argentina (${ctx.mes}).`;
}
