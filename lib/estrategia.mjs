// CAMBIOS: Incrementé la versión a 17, diversifiqué las categorías priorizando kits de ferretería liviana, bazar funcional y accesorios automotrices de alta rotación, y optimicé los umbrales de costos y márgenes para el mercado argentino.
export const VERSION = 17;

export const categorias = [
  'kits de herramientas manuales para taller liviano y reparación de precisión',
  'bazar de especialidad, utensilios de cocina y equipamiento para baristas',
  'accesorios y herramientas de mantenimiento para vehículos y carrocería',
  'instrumental de medición digital, nivelación y diagnóstico técnico portátil',
  'combos de consumo masivo, organización del hogar y orden de equipaje',
  'equipamiento de audio pasivo, soportes para streaming y accesorios de microfonía',
  'herramientas de refrigeración, climatización y detección de fugas',
  'herramientas para carpintería, perforación limpia y encastre de precisión'
];

export const temas = [
  'cálculo exacto del landed cost por courier privado en Argentina',
  'optimización del margen neto en Mercado Libre ajustando comisiones e impuestos localizados',
  'estrategias de armado de combos de alto valor percibido para elevar el ticket promedio',
  'filtrado de productos por relación precio y peso para reducción de flete internacional',
  'validación de rotación con volumen de ventas reales en AliExpress, Amazon y Mercado Libre',
  'negociación de compras al por mayor en 1688 y Alibaba con bajo costo unitario',
  'reducción de costos publicitarios en Meta Ads enfocado en productos de especialidad',
  'estrategias de pricing en Tiendanube y Shopify para ventas directas sin comisiones de marketplace'
];

export const temasVideo = [
  'cómo calcular la rentabilidad real de importaciones courier en Argentina',
  'productos ganadores de alto margen en bazar y herramientas para e-commerce',
  'estrategias de pricing para duplicar la ganancia neta en Mercado Libre',
  'técnicas para armar kits comerciales con costo de origen inferior a 10 dólares',
  'validación de demanda comprobada antes de realizar la primera compra'
];

export const productosPorVuelta = 5;

export function instruccionesBusqueda(ctx) {
  const indice = (ctx.vuelta || 0) % categorias.length;
  const categoriaObjetivo = categorias[indice];
  const cantidadAprobados = (ctx.aprobados && ctx.aprobados.length) || 0;

  return `Concentrate en la categoría "${categoriaObjetivo}".
Buscá productos que cumplan estrictamente los siguientes requisitos:
1. Presentación en formato de kit completo, combo organizador o pack de varias unidades que eleve el valor percibido, evitando productos individuales de bajo valor.
2. Peso físico menor a 1.5 kg y tamaño compacto para optimizar el flete por courier.
3. Precio de venta al público en Argentina comprendido entre $35.000 ARS y $190.000 ARS.
4. Costo de compra con proveedor en origen menor a 12 USD, que represente como máximo el 20% del precio de venta final.
5. Libres de homologaciones complejas (sin certificaciones ENACOM ni registros ANMAT) y sin infracción de marcas registradas.
6. Demanda comprobada en plataformas de origen o mercado local con ventas reales verificables. Mes de análisis: ${ctx.mes}. Cantidad acumulada de productos aprobados: ${cantidadAprobados}.`;
}
