/* Folio · arranque: recupera el último trabajo y abre la primera etapa */
(async function () {
  'use strict';
  try { await ARCHIVO.cargar(); } catch (e) { console.error('Archivo de grabados', e); }
  await Perfil.cargar();
  try { Tipografias.registrarCSS(); } catch (e) { console.error(e); }
  try { if (window.Escritorio && Escritorio.herr) { App.vectores = await Escritorio.herr.vectores(); HerrLocal.leer().catch(() => {}); } } catch (e) { console.error(e); }
  let recuperado = null;
  try {
    if (window.Escritorio) recuperado = await Escritorio.recuperar();
    else { const t = localStorage.getItem('folio-autoguardado'); if (t) recuperado = JSON.parse(t); }
  } catch (e) { console.error(e); }
  // el libro se guardó después en el otro computador: se abre esa versión (la copia de este equipo sigue en las copias diarias)
  if (recuperado && recuperado.discoMasNuevo && window.Escritorio) {
    try { const r = await Escritorio.abrirProyecto(recuperado.ruta); if (r && !r.cancelado) { Folio.cargar(r.datos.proyecto, r.ruta, Folio.conPrefijo(r.datos.recursos || {}), r.datos.originales || {}); Folio.guardadoDisco = new Date(); setTimeout(() => App.aviso(`Abrí «${Folio.p.titulo || 'tu libro'}» tal como se guardó en ${recuperado.discoMasNuevo.equipo}, que es más reciente que lo que quedó en este computador.`, { ms: 9000 }), 1500); Folio.avisoEnUso(r.enUso); recuperado = null; } }
    catch (e) { console.error(e); }
  }
  if (recuperado && recuperado.proyecto && recuperado.proyecto.bloques && recuperado.proyecto.bloques.length) {
    Folio.cargar(recuperado.proyecto, recuperado.ruta || null, recuperado.recursos || {});
    Folio.sucio = !!recuperado.ruta; // la copia automática puede tener cambios posteriores al último guardado en disco
    Folio.avisoEnUso(recuperado.enUso);
  }
  await document.fonts.ready;
  App.cabecera(); App.camino(); App.pintar();
  const r = await window.Bestiario.poblar();
  if (recuperado && Folio.p.bloques.length) App.aviso(`Recuperé «${Folio.p.titulo || 'tu libro'}» tal como quedó la última vez.`, { accion: { texto: 'Empezar otro', hacer: () => App.nuevo() } });
  document.documentElement.dataset.listo = '1';
  window.__poblado = r;
})();
