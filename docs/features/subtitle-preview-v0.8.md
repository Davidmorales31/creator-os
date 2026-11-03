# Creator OS v0.8 — Subtítulos sincronizados en la previsualización

1. Abre un proyecto y selecciona un video importado.
2. En **Transcripción**, genera una transcripción o utiliza una ya guardada.
3. En el reproductor, selecciona la versión y pulsa **CC desactivados** para activar subtítulos.
4. Reproduce, pausa o mueve la barra de búsqueda; los subtítulos siguen el reloj del video original.
5. Pulsa **CC activados** para ocultarlos.

Los subtítulos se renderizan en la interfaz y **no alteran el video**. Para archivos SRT/VTT utiliza las acciones de exportación del panel de transcripción (Issue #19).

Limitaciones: las marcas corresponden al archivo original seleccionado, no todavía al montaje del timeline. No se incrustan en el MP4 ni se generan pistas de edición.

Validación: `node --experimental-strip-types scripts/test-captions.mjs` más CI completo y capturas Chromium. La revisión nativa de Tauri/macOS/Windows/Linux queda pendiente. Coste de nube y API: **$0**.
