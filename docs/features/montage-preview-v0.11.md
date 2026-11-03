# v0.11 — Reproducir el montaje (primera versión)

En Creator OS Editor, importa un video y añádelo al timeline. Puedes añadir más clips (del mismo archivo o de otros videos), recortarlos, dividirlos y ordenarlos.

Pulsa **Reproducir montaje** encima de las pistas. La aplicación validará que exista una sola pista de video con clips **continuos desde el frame 0**, sin huecos ni solapamientos. Si el timeline contiene otra pista con contenido, imágenes, audio independiente o clips incompatibles, mostrará un motivo concreto. No ocultará medios ni saltará fragmentos silenciosamente.

El reproductor abre la fuente correspondiente, aplica el recorte, reproduce hasta el final de cada clip y avanza al siguiente. El playhead del timeline utiliza el reloj real de ese video. Pulsa **Detener montaje** para finalizar.

**Importante:** esta es reproducción secuencial básica; el cambio de archivo puede introducir un breve retraso. No son cortes de precisión de frame entre decodificadores, no se mezclan pistas de audio separadas y las transiciones animadas todavía no están implementadas. Para obtener el archivo final, utiliza el exportador MP4 local.

## Comprobaciones

```sh
node --experimental-strip-types scripts/test-montage-plan.mjs
pnpm typecheck
pnpm web:build
```

La revisión visual simula dos clips y comprueba el cambio de segmento en el elemento HTML de video. Esto no demuestra el funcionamiento real de Tauri en una máquina de usuario. Continúan pendientes pruebas nativas de códigos de video, pausa/seek, cambios de proyecto y códecs. Sin costes de APIs ni servidores; solo recursos locales de reproducción.

Ver `docs/adr/0012-sequential-montage.md`.
