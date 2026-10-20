# Folio

Del manuscrito al libro impreso. App de escritorio para Windows que funciona sin internet.

Etapas: Manuscrito · Revisión · Datos · Interior · Cubierta · Impresión · Costo.
Incluye un archivo de 2.536 grabados de dominio público con su ficha de procedencia.

## Compilar
Cada push a `main` compila en GitHub Actions (Windows) y deja `Folio-…-portatil.exe` y `Folio-…-instalador.exe`
en la pestaña Actions, sección Artifacts. Con una etiqueta `v2.0.1` se publica además como Release.

## Desarrollo local
    npm ci
    npm start          # abre la app
    npm run prueba     # prueba de punta a punta
    npm run dist       # compila el .exe (en Windows)

Licencias de las herramientas y tipografías: ver `app/fuentes` y `app/vendor`. Créditos de imágenes: `app/archivo/catalogo.json`.
