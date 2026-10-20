/* Folio · arranque: recupera el último trabajo y abre la primera etapa */
(async function () {
  'use strict';
  try { await ARCHIVO.cargar(); } catch (e) { console.error('Archivo de grabados', e); }
  let recuperado = null;
  try {
    if (window.Escritorio) recuperado = await Escritorio.recuperar();
    else { const t = localStorage.getItem('folio-autoguardado'); if (t) recuperado = JSON.parse(t); }
  } catch (e) { console.error(e); }
  if (recuperado && recuperado.proyecto && recuperado.proyecto.bloques && recuperado.proyecto.bloques.length) {
    Folio.cargar(recuperado.proyecto, recuperado.ruta || null, recuperado.recursos || {});
    Folio.sucio = !!recuperado.ruta; // la copia automática puede tener cambios posteriores al último guardado en disco
  }
  await document.fonts.ready;
  App.cabecera(); App.camino(); App.pintar();
  const r = await window.Bestiario.poblar();
  if (recuperado && Folio.p.bloques.length) App.aviso(`Recuperé «${Folio.p.titulo || 'tu libro'}» tal como quedó la última vez.`, { accion: { texto: 'Empezar otro', hacer: () => App.nuevo() } });
  document.documentElement.dataset.listo = '1';
  window.__poblado = r;
})();
