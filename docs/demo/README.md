# Video de la demo

Hay tres formas de usar esta carpeta:

1. **Video automático** (`npm run demo`): un navegador real recorre la web, el chat y el panel y graba el video con
   subtítulos. Sale en `docs/demo/salida/` (`.mp4` y `.webm`; no se sube a git) y las capturas en `docs/demo/capturas/`.
2. **Guion** (`GUION.md`): locución y tiempos, para grabarlo en vivo con tu propia voz (OBS o Loom) o doblar el video automático.
3. **Capturas** (`capturas/*.png`): una imagen por escena, para láminas o el informe.

## Cómo correrlo

Con el servidor local en marcha (`npm run dev`, en http://localhost:5173):

```bash
npm run demo -- --sin-panel
```

Graba landing, catálogo, cotizar y chat. No necesita credenciales.

### Con el panel

El panel pide usuario. Define las credenciales **en tu terminal** (nunca en el chat ni en un archivo del repositorio):

PowerShell:

```powershell
$env:DEMO_PANEL_EMAIL = "correo-del-personal@..."
$env:DEMO_PANEL_PASSWORD = "su-contraseña"
npm run demo
```

Git Bash / macOS / Linux:

```bash
DEMO_PANEL_EMAIL="correo-del-personal@..." DEMO_PANEL_PASSWORD="su-contraseña" npm run demo
```

El video muestra el correo escrito en el formulario de ingreso (la contraseña sale oculta). Usa una cuenta de personal con rol
administración.

### Sobre la web desplegada

Para grabar contra producción en vez de local: `DEMO_URL=https://tu-landing` y `DEMO_PANEL_URL=https://tu-panel`.

## Antes de grabar

- Cierra cualquier conversación o dato de prueba que no quieras mostrar.
- El chat usa la IA si hay `GEMINI_API_KEY` en el Worker; si no, responde en modo guiado (más corto).
- Si Google está saturado, el asistente reintenta una vez y luego usa el modo guiado; vuelve a correr el script.
- Dura unos 3 a 4 minutos. Si quieres cambiar textos o el orden de las escenas, edita `scripts/demo/grabar-demo.mjs`.
