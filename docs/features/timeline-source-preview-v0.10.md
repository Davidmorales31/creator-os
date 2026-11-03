# v0.10 — Previsualización del clip seleccionado desde el timeline

En el Editor, añade un video al timeline. Haz clic en el clip para abrir en el reproductor su posición original considerando el recorte de entrada. También puedes pulsar una marca de tiempo de la regla para buscar el video correspondiente.

Al reproducir o mover el cabezal del video, el cursor del timeline puede seguir la posición correspondiente **dentro de ese clip**. Si seleccionas un espacio vacío, el Editor avisa que allí no hay video.

**Importante:** esto es **preview de un clip**, no reproducción encadenada del montaje completo, no mixer de pistas, ni subtítulos montados. La vista previa usa el gateway local ya existente y nunca altera el archivo fuente.

Para validar la transformación temporal:

```sh
node --experimental-strip-types scripts/test-timeline-preview.mjs
```

La captura automatizada verifica el click del clip y el player nativo React en Chromium con datos de prueba. El release Tauri debe verificarse manualmente en sistemas soportados (seek, trim, fuentes múltiples, cierre/reapertura). Coste de API e infraestructura de render remota: $0.
