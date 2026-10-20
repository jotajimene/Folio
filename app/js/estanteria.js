/* Folio · estantería: los lomos de tus libros, para abrir cualquiera o empezar uno nuevo */
(function () {
  'use strict';
  const { esc } = App;
  // cada vez que se guarda o se abre un libro, queda en la estantería
  async function registrar() {
    const p = Folio.p; if (!Folio.ruta || !window.Perfil) return;
    const c = Folio.coleccion(), pal = (p.cubierta.colores && p.cubierta.colores.length === 3) ? p.cubierta.colores : c.paletas[(p.cubierta.paleta || 0) % c.paletas.length];
    const r = { ruta: Folio.ruta, titulo: p.titulo || 'Sin título', autor: p.autor || '', coleccion: c.nombre, numero: p.numero, colores: pal, paginas: (p.composicion && p.composicion.paginas) || null, formato: p.formato, fecha: new Date().toISOString(), fuente: c.titulos };
    Perfil.datos.recientes = [r, ...(Perfil.datos.recientes || []).filter(x => x.ruta !== r.ruta)].slice(0, 40);
    await Perfil.guardar();
  }
  Folio.al(m => { if (m === 'guardado' || m === 'cargar') setTimeout(registrar, 50); });
  function lomos(lista, chico) {
    return lista.map((r, i) => {
      const [fondo, tinta] = r.colores || ['#efe6d2', '#1b1612'];
      const alto = ({ A6: 148, A5: 210, '13×20': 200, '15×23': 230, '17×24': 240 }[r.formato] || 210) * (chico ? .6 : .95);
      const ancho = Math.max(chico ? 18 : 26, Math.min(chico ? 40 : 64, ((r.paginas || 80) / 4) * (chico ? .45 : .7)));
      return `<button class="lomo-libro" data-ruta="${esc(r.ruta)}" title="${esc(r.titulo)} · ${esc(r.autor)}\n${esc(r.ruta)}" style="height:${alto}px;width:${ancho}px;background:${tinta};color:${fondo}"><span style="font-family:${esc(r.fuente || 'Fell')}">${esc(r.titulo)}</span><small>${esc(r.coleccion)} ${esc(r.numero || '')}</small></button>`;
    }).join('');
  }
  async function abrirRuta(ruta) {
    if (Folio.sucio && Folio.p.bloques.length && !(await App.confirmar('Hay cambios sin guardar en disco (la copia automática sí los tiene). ¿Abrir otro libro igualmente?', 'Abrir'))) return;
    try { const r = await Escritorio.abrirProyecto(ruta); if (r && !r.cancelado) { Folio.avisoEnUso(r.enUso); Folio.cargar(r.datos.proyecto, r.ruta, {}, r.datos.originales || {}); Folio.recursos = Object.fromEntries(Object.entries(r.datos.recursos || {}).map(([k, v]) => [k, 'data:' + (/\.png$/i.test(k) ? 'image/png' : /\.(jpe?g)$/i.test(k) ? 'image/jpeg' : /\.otf$/i.test(k) ? 'font/otf' : 'application/octet-stream') + ';base64,' + v])); Folio.guardadoDisco = new Date(); App.aviso('Libro abierto.'); App.ir(0, { forzar: true }); } }
    catch (e) { App.aviso('No encontré ese archivo; quizá se movió o se borró. ' + e.message, { tipo: 'mal', ms: 7000 }); Perfil.datos.recientes = (Perfil.datos.recientes || []).filter(x => x.ruta !== ruta); Perfil.guardar(); }
  }
  async function abrir() {
    const lista = (window.Perfil && Perfil.datos.recientes) || [];
    await App.modal({ titulo: 'Estantería', ancho: 1000, cuerpo: `${lista.length ? `<div class="repisa">${lomos(lista)}</div><p class="nota">Los libros que has guardado o abierto con Folio, del más reciente al más antiguo.</p>` : '<p class="nota">Aún no hay libros en la estantería: aparecen aquí cuando los guardas.</p>'}`,
      botones: [{ texto: 'Cerrar', valor: null }, { texto: 'Abrir otro archivo…', valor: 'abrir' }, { texto: 'Libro nuevo', valor: 'nuevo' }],
      alAbrir: (m, ctx) => m.addEventListener('click', e => { const l = e.target.closest('[data-ruta]'); if (l) { ctx.cerrar(null); abrirRuta(l.dataset.ruta); } }) }).then(v => { if (v === 'abrir') App.abrir(); if (v === 'nuevo') App.nuevo(); });
  }
  function mini() { const lista = (window.Perfil && Perfil.datos.recientes) || []; return lista.length ? `<div class="repisa chica">${lomos(lista.slice(0, 18), true)}</div>` : ''; }
  document.addEventListener('click', e => { const l = e.target.closest('.mesa [data-ruta]'); if (l) abrirRuta(l.dataset.ruta); });
  window.Estanteria = { abrir, mini, registrar };
})();
