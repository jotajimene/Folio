# Folio

Del manuscrito al libro impreso. App de escritorio para Windows que funciona sin internet.

## Qué hace
- **Manuscrito**: importa Word (con cursivas y notas al pie), PDF, ODT, RTF, texto, Markdown, HTML y páginas escaneadas (OCR en español). Detecta poemarios y arma estrofas. Edición por bloques, versiones con nombre, lectura en voz alta.
- **Revisión**: ortografía (diccionario RLA-ES), ortotipografía, gramática y uso, estilo. Todo son propuestas. Lectura de estilo con un modelo de texto local (llama.cpp) que corre en el computador. Ida y vuelta con un corrector humano por Word con control de cambios.
- **Datos**: preliminares, créditos, colofón, contracubierta, sinopsis y el perfil de la editorial (sello, logo, numeración de colecciones, paletas, tipografías propias).
- **Interior**: Paged.js; la vista es el libro impreso y se puede editar haciendo clic en él. Notas al pie, índice, índice analítico, librojuegos, grabados del archivo, tus imágenes (tal cual o como grabado, semitono o línea), fotos a sangre y a doble página.
- **Cubierta**: nueve líneas estéticas con su propio generador; paletas de la biblioteca o propias; encuadre de fragmentos; imágenes propias.
- **Impresión**: PDF de lectura o para imprenta (sangrado y marcas de corte), pliegos para cuadernillos cosidos, lomo pegado, fanzine, acordeón y cosido japonés; ejemplares numerados; hoja de prueba a dos caras; libro digital EPUB; hojear el libro.
- **Costo** por ejemplar y según la tirada.
- **Archivo de grabados**: 2.536 láminas de dominio público con su ficha de procedencia.

## Compilar
Cada push a `main` compila en GitHub Actions (Windows) y publica en Releases `Folio-…-portatil.exe` y `Folio-…-instalador.exe`.

## Desarrollo
    npm ci
    npm start          # abre la app
    npm run prueba     # pruebas de punta a punta (pruebas/e2e.js y pruebas/e2e2.js)

El modelo de texto local se descarga desde la app (Archivo → Modelo de texto local…) a la carpeta de datos de Folio.
