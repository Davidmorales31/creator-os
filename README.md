# Creator OS

**Creator OS** es un editor de video de escritorio, *local-first* y open source, enfocado en flujos de trabajo de creadores de contenido.

**Estado:** prototipo funcional con reproducción secuencial multifuente v0.12 integrada en `main`. Validación de arranque nativo automatizada v0.13 en desarrollo; **no es todavía una versión de producción ni un instalador validado**. Pruebas funcionales nativas multiplataforma pendientes.

## Módulos implementados

- Proyectos locales: crear, abrir, recientes, versión de esquema/migración.
- Importación de medios y metadatos con FFprobe; preview local mediante un gateway de loopback.
- Interfaz claro/oscuro, identidad **Totem Cut**, navegación de escritorio.
- Timeline de video/audio con clips, división, recorte, mover, borrar y undo/redo persistido.
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

El flujo [Native desktop build](.github/workflows/native-desktop.yml) compila el ejecutable Tauri en Linux y, desde v0.13, incluye un smoke test de **arranque real en Xvfb**, con captura y logs. Este test **no certifica funciones de edición ni el comportamiento en Windows/macOS**. Ver [lista de aceptación nativa](docs/quality/NATIVE_ACCEPTANCE.md).

## Licencia

MIT para código original de Creator OS, salvo indicación distinta. FFmpeg, Whisper y otros proveedores conservan sus respectivas licencias; hay requisitos específicos antes de distribuir binarios y modelos.
