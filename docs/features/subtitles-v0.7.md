# v0.7 — Exportación de subtítulos SRT y WebVTT

Desde **Editor → Transcripción**, abre o genera una transcripción del medio seleccionado. Pulsa **Exportar .srt** o **Exportar .vtt**. Creator OS crea un nuevo archivo UTF-8 en la carpeta local del proyecto `subtitles/`, muestra su ruta y mantiene intacta la transcripción original.

## Compatibilidad

SRT sirve para flujos de publicación y editores comunes; WebVTT para reproductores web y flujos que admitan ese formato. Se exportan los segmentos temporizados de la transcripción v1. No se incrustan automáticamente en MP4 ni se añaden a la línea de tiempo.

Si hay segmentos que se solapan o la transcripción está vacía, la aplicación muestra un error. Esto evita exportaciones de contenido ambiguo.

## Validación

- Domain Rust: tiempos exactos, horas > 1, acentos, Unicode, saltos de línea, errores de esquema, transcripción vacía y solapamientos.
- Desktop Tauri: identifica el proyecto, asset y registro por UUID; no recibe rutas elegidas arbitrariamente. Guarda con nombre único en `subtitles/`.
- Frontend: estados de botones y ruta guardada; las capturas de CI ejecutan el flujo mediante fixtures.
- Native manual: comprobar SRT/VTT en un editor externo, revisar timing del idioma original, confirmar que los originales no cambian.

## Presupuesto

No se llama a una API ni se ejecutan modelos para formatear subtítulos existentes. Uso local de CPU/memoria reducido; ocupa un archivo adicional pequeño.
