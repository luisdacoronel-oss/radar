# RADAR · Módulo de Inversiones + Consejo de IAs

Este módulo se suma al repositorio de RADAR en GitHub. Funciona en la nube cada 30 minutos, las 24 horas, aunque su PC esté apagada. **No envía mensajes nuevos de WhatsApp**: los avisos de RADAR siguen exactamente como están configurados hoy.

## Qué hace

| Parte | Qué muestra |
|---|---|
| **Resumen** | Dólar (MEP, CCL, cripto, oficial), inflación, riesgo país, la mejor opción de bajo riesgo, rulos que convienen y activos con señal de compra o venta. |
| **Gráficos** | Velas con medias móviles de 20, 50 y 200, retroceso y extensión de Fibonacci y RSI 14, más el gráfico en vivo de TradingView (gratis). Indica entrada, objetivo y stop. |
| **Rulos** | MEP→CCL, MEP→cripto, cripto→MEP, oficial→MEP, con ganancia neta después de comisiones. |
| **Rendimientos** | Plazo fijo, FCI money market, dólar digital con interés, acciones, CEDEARs, cripto y la **mercadería de RADAR de Ventas**, comparados contra la inflación. |
| **Consejo de IAs** | Cada IA gratuita vota (comprar, vender o esperar) y explica por qué. Se muestra el acuerdo y usted decide. |
| **Aprendizaje** | Cada recomendación se controla a los 5 y 20 días. Las IA y señales que más aciertan pesan más en las siguientes decisiones. |
| **Noticias** | Titulares que RADAR leyó en Google Noticias en cada ciclo. |

## Instalación (una sola vez, unos 15 minutos)

1. **Copiar los archivos** al repositorio de RADAR, respetando las carpetas: `inversiones/`, `datos/`, `.github/workflows/inversiones.yml` e `inversiones.html`.
2. **Activar GitHub Pages**: en el repositorio, *Settings → Pages → Source: Deploy from a branch → main / (root)*. El panel queda en `https://SU-USUARIO.github.io/SU-REPO/inversiones.html`.
3. **IAs gratuitas**: GitHub Models funciona sola, sin clave. Para sumar más opiniones, cree estas claves gratuitas y cárguelas en *Settings → Secrets and variables → Actions → New repository secret*:

   | Secret | Dónde se obtiene (gratis) |
   |---|---|
   | `GEMINI_API_KEY` | aistudio.google.com → *Get API key* |
   | `GROQ_API_KEY` | console.groq.com → *API Keys* |
   | `OPENROUTER_API_KEY` | openrouter.ai → *Keys* |
   | `MISTRAL_API_KEY` | console.mistral.ai → plan *Experiment* |
   | `CEREBRAS_API_KEY` | cloud.cerebras.ai → *API Keys* |

   Puede cargar solo algunas: las que falten simplemente no votan.
4. **Primera ejecución**: pestaña *Actions → RADAR Inversiones → Run workflow*. Desde ahí, se repite sola cada 30 minutos.

## Ajustes (archivo `inversiones/config.json`)

- `activos`: agregue o quite acciones, CEDEARs o cripto (código de Yahoo y de TradingView).
- `capitalReferencia`: monto con el que se calculan los resultados de los rulos.
- `comisionPorOperacion`: 0.006 = 0,6 % por operación.
- `minimoRuloNeto`: 0.01 = solo marca como conveniente un rulo que deje 1 % o más.

## Integración con RADAR de Ventas

Si RADAR guarda `datos/productos.json` con este formato, la mercadería entra en la comparación de rendimientos:

```json
[{ "nombre": "Auriculares X", "margen": 3.0, "diasVenta": 20, "proveedor": "Proveedor Y" }]
```
(`margen` 3.0 = 300 %; `diasVenta` = días estimados para vender el lote).

## Asistente P. — Cerebro multi-IA

La carpeta `p-asistente/` contiene `api/consejo.js` y `lib/ia.mjs`, que se copian al proyecto de P. en Vercel. Las mismas claves se cargan en *Vercel → Settings → Environment Variables*. P. llama a `/api/consejo`:

- **Charla** → responde la IA más rápida (poca demora en la voz).
- **Decisiones** (dinero, compras, comparaciones, salud, leyes) → consulta a todas, compara y redacta la mejor respuesta.

## Límites honestos

- Ninguna señal ni IA puede asegurar ganancias. RADAR ordena la información; la decisión final es suya.
- Antes de hacer un rulo, verifique la normativa vigente (CNV/BCRA), que cambia con frecuencia.
- En TradingView gratis, algunos símbolos de la bolsa argentina pueden no mostrarse dentro del widget; el gráfico propio de RADAR siempre funciona. Los niveles de Fibonacci calculados están en el gráfico de RADAR; en TradingView se dibujan con la herramienta de la barra lateral.
- Con repositorio **público**, GitHub Actions es ilimitado. Con repositorio **privado**, el plan gratis da 2.000 minutos por mes: alcanza para un ciclo cada 30 minutos.
