# Creator OS

**Creator OS** es un editor de video de escritorio, *local-first* y open source, enfocado en flujos de trabajo de creadores de contenido.

**Estado:** prototipo funcional con reproducción secuencial v0.12 y validaciones nativas Linux v0.13–v0.19 integradas en `main`. La v0.17 añadió atajos de teclado y la v0.18 verificó la **exportación MP4 real de dos clips** desde Tauri mediante FFmpeg/FFprobe y archivos originales intactos. En v0.19 se validó también la **cancelación real de FFmpeg** en Tauri Linux, limpieza de procesos y temporales, bloqueo de exportaciones concurrentes y recuperación tras cancelar. **No es todavía una versión de producción ni un instalador validado**: quedan pendientes la recuperación tras cierre inesperado y la aceptación manual multiplataforma. El [Issue #41](https://github.com/Davidmorales31/creator-os/issues/41) sigue abierto para recuperar los repositorios open source originales antes de nuevos módulos. El [roadmap de los siguientes 10 pasos](https://github.com/Davidmorales31/creator-os/issues/60) distingue trabajos terminados, pendientes y bloqueados.

## Plan maestro y reutilización open source

**Estrategia del proyecto:** integrar y adaptar repositorios open source existentes siempre que sea viable y legalmente compatible; no reconstruir todo desde cero. La lista histórica exacta de repositorios seleccionados por el propietario está pendiente de recuperación y **no debe inventarse**. Antes de desarrollar módulos, lee [AGENTS.md](AGENTS.md), [plan maestro provisional](docs/PROJECT_MASTER_PLAN.md) y [registro de integraciones externas](docs/OPEN_SOURCE_INTEGRATIONS.md). El [índice en Drive](https://docs.google.com/document/d/1vq27TzAcozCOx2ec9aIMIcM3W6KKiRqOdstmszv5-Kc/edit?usp=drivesdk) es una guía de acceso, mientras GitHub conserva la verdad técnica.

## Módulos implementados

- Proyectos locales: crear, abrir, recientes, versión de esquema/migración.
- Importación de medios y metadatos con FFprobe; preview local mediante un gateway de loopback.
- Interfaz claro/oscuro, identidad **Totem Cut**, navegación de escritorio.
- Timeline de video/audio con clips, división, recorte, mover, borrar y undo/redo persistido. Atajos contextualizados al foco del timeline: Ctrl/Cmd+Z (deshacer), Ctrl/Cmd+Shift+Z o Ctrl+Y (rehacer), S (dividir) y Supr/Retroceso (eliminar); se desactivan mientras se escribe en campos.
- Exportación MP4 H.264/AAC con FFmpeg para **una pista de video continua**.
- Transcripción de segmentos temporizados con proveedor Python opcional `faster-whisper`, CPU-first, con consentimiento previo para descargar modelos.
- Exportación de subtítulos SRT y WebVTT.
- Previsualización CC sincronizada **con el medio original seleccionado**, no con el montaje del timeline.
- Reproducción secuencial del montaje: transiciones multifuente protegidas frente a eventos obsoletos y seek confirmado; **no se garantiza continuidad frame-perfect**.

## Arquitectura

| Capa | Tecnología |
| --- | --- |
| Escritorio | Tauri 2 + React + TypeScript |
| Contratos/dominio | Crates Rust independientes |
| IA local opcional | Worker Python, proveedores reemplazables |
| Medios | Adaptador FFmpeg/FFprobe |
| Persistencia | Archivos de proyecto locales, esquema versionado |
| Diseño | Design tokens compartidos, temas claro y oscuro |

Dominio sin dependencias de React, Tauri, FFmpeg ni proveedores IA. Nunca se envían medios a una API para las funciones locales actuales. Las fuentes originales no se alteran por las operaciones del editor.

## Desarrollo

Requisitos: Node 22, pnpm 9.15, toolchain Rust y dependencias del sistema para Tauri 2. FFmpeg/FFprobe se instalan por separado para medios/exportación. Python/Whisper son opcionales y no se descargan sin permiso.

```sh
pnpm install
pnpm typecheck
pnpm web:build
cargo test --workspace
pnpm --dir apps/desktop exec tauri dev
```

### Política de ramas

- `main`: versión integrada y validada.
- `develop`: **única rama activa de trabajo**; PRs directos `develop → main`, sin PRs apilados.

Ver [Política de ramas](docs/development/BRANCH_POLICY.md), [Constitución](CONSTITUTION.md), [arquitectura](docs/architecture/ARCHITECTURE.md) y [ADRs](docs/adr/).

### Prueba nativa

El flujo [Native desktop build](.github/workflows/native-desktop.yml) compila el ejecutable Tauri en Linux y, desde v0.13, incluye un smoke test de **arranque real en Xvfb**, con captura y logs. Desde v0.14, CI valida creación y persistencia reales de proyectos con Tauri WebDriver sobre Linux. La v0.15 integra una prueba de importación FFprobe y reproducción VP8/VP9 en el WebView nativo. La v0.16 añade a CI pruebas de dos clips contiguos, undo/redo y cambio de fuente VP8→VP9 en un montaje real. La v0.17 añade atajos de edición focalizados al timeline y comprueba operaciones de teclado en el mismo E2E nativo. La v0.18 añade un E2E de exportación MP4 H.264/AAC utilizando los comandos reales de Tauri, FFmpeg y FFprobe, con fuentes intactas. La v0.19 **integrada** probó la cancelación de un render realmente activo, la limpieza de proceso/temporales, `export_busy` y la recuperación para un segundo job, mediante FFmpeg real con entradas limitadas a velocidad real exclusivamente en el runner. CI Rust/frontend/Python, E2E nativo y revisión visual aprobaron el [PR #52](https://github.com/Davidmorales31/creator-os/pull/52). El smoke v0.13 **no certifica funciones de edición ni el comportamiento en Windows/macOS**. Ver [lista de aceptación nativa](docs/quality/NATIVE_ACCEPTANCE.md).

## Licencia

MIT para código original de Creator OS, salvo indicación distinta. FFmpeg, Whisper y otros proveedores conservan sus respectivas licencias; hay requisitos específicos antes de distribuir binarios y modelos.
