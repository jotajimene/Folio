/* Folio · etapa V · Cubierta */
(function () {
  'use strict';
  const { esc, panel } = App;
  let modo = 'frente', ultimo = null, turno = 0;

  async function dibujar() {
    const caja = document.querySelector('.caja-cubierta'); if (!caja) return;
    const t = ++turno;
    await ARCHIVO.cargar();
    const p = Folio.p;
    const r = await Cubiertas.imprimible(p, { modo, k: 3.2, recursos: Folio.recursos, paginas: (p.composicion && p.composicion.paginas) || estimarPaginas() });
    if (t !== turno) return;
    ultimo = r;
    const raiz = caja.shadowRoot || caja.attachShadow({ mode: 'open' });
    raiz.innerHTML = `<style>${r.css.replace(/@page[^}]*}/, '')} :host{display:block} .cub{box-shadow:5px 5px 0 #1b1612;outline:2px solid #1b1612}</style>${r.html}`;
    // escalar al espacio disponible
    const cont = caja.parentElement, mmPx = 96 / 25.4;
    const k = Math.min((cont.clientWidth - 20) / (r.mm[0] * mmPx), (cont.clientHeight - 20) / (r.mm[1] * mmPx));
    caja.style.zoom = Math.max(.2, k);
    const av = document.querySelector('.avisos-cubierta');
    if (av) av.innerHTML = r.avisos.map(a => `<li class="mal">${esc(a)}</li>`).join('') + (modo === 'extendida' ? `<li>Lomo <span>${String(r.medidas.lomo).replace('.', ',')} mm</span></li><li>Pliego de cubierta <span>${r.mm.map(x => Math.round(x * 10) / 10).join(' × ')} mm</span></li>` : '');
    const fi = document.querySelector('.ficha-grabado');
    if (fi) fi.innerHTML = fichaHTML(r.laminas);
  }
  function estimarPaginas() { const pal = Folio.p.bloques.reduce((a, b) => a + (b.texto.match(/\S+/g) || []).length, 0); return Math.max(16, Math.ceil(pal / 260) + 8); }
  function fichaHTML(ids) {
    if (!ids || !ids.length) return '<p class="nota">Este sistema no usa grabados: es puramente tipográfico.</p>';
    return ids.slice(0, 3).map(id => { const f = ARCHIVO.ficha(id); if (!f) return ''; return `<div class="ficha-mini"><img src="${ARCHIVO.mini(id)}" alt=""><div><b>${esc(f.fuente.obra || f.fuente.nombre)}</b><small>${esc(f.pagina.a)}${f.pagina.y ? ' · ' + f.pagina.y : ''} · ${esc(f.pagina.l || '')}</small><button class="enlace" data-ver="${id}">ver el original</button></div></div>`; }).join('') + (ids.length > 3 ? `<p class="nota">y ${ids.length - 3} más de la misma fuente.</p>` : '');
  }
  function sugerencias() {
    if (!ARCHIVO.listo) return '';
    const s = ARCHIVO.elegir(l => l.tipo === 'figura' && l.w > 260 && l.h > 260, Folio.p.cubierta.semilla * 31 + 5, 9);
    return `<div class="miniaturas">${s.map(l => `<button data-lam="${l.id}" class="${Folio.p.cubierta.imagen === l.id ? 'on' : ''}"><img src="${ARCHIVO.mini(l.id)}" alt="" loading="lazy"></button>`).join('')}</div>`;
  }
  function render() {
    const p = Folio.p, c = Folio.coleccion();
    const usaImagen = !['tipografica', 'texto', 'puntos'].includes(c.generador);
    return {
      cols: '270px 1fr 300px',
      html: panel('sistema', 'Colección', c.nombre, `<div class="colecciones compacta">${Folio.COLECCIONES.map((x, i) => `<button class="coleccion ${x.id === p.coleccion ? 'on' : ''}" data-col="${x.id}" title="${esc(x.descripcion)}"><span class="muestra" style="font-family:${x.titulos}">Aa</span><span><b>${String(i + 1).padStart(2, '0')} ${esc(x.nombre)}</b><small>${esc({ grabado: 'grabado clásico', teselacion: 'teselación', foto: 'foto en semitono', campos: 'campos de color', cenefas: 'cenefas', tipografica: 'inicial monumental', detalle: 'detalle ampliado', reticula: 'retícula de nueve', texto: 'textura de texto', puntos: 'constelación' }[x.generador])}</small></span></button>`).join('')}</div>
        <p class="nota">${esc(c.descripcion)}</p>
        <div class="campos" style="grid-template-columns:1fr 70px"><label class="campo"><span>Número en la colección</span><input data-k="numero" value="${esc(p.numero)}"></label></div>
        <div class="sub">Paleta</div><div class="paleta">${c.paletas.map((pl, i) => `<button class="${p.cubierta.paleta % c.paletas.length === i ? 'on' : ''}" data-paleta="${i}" title="Paleta ${i + 1}" style="background:linear-gradient(135deg,${pl[0]} 0 50%,${pl[1]} 50% 75%,${pl[2]} 75%)"></button>`).join('')}</div>
        <button class="boton" data-r="variar" style="width:100%">↻ Otra variación</button>
        <label class="ajuste"><span>Tamaño del título</span><input type="range" min="0.6" max="1.6" step="0.05" value="${p.cubierta.escalaTitulo || 1}" data-esc="1"></label>`) +
        panel('cubierta', 'La cubierta', modo === 'frente' ? `frente · ${p.formato}` : 'extendida: contracubierta, lomo y frente', `<div class="fila-botones centrada"><button class="boton chico ${modo === 'frente' ? 'taco' : ''}" data-modo="frente">Frente</button><button class="boton chico ${modo === 'extendida' ? 'taco' : ''}" data-modo="extendida">Extendida con lomo</button></div><div class="escenario-cubierta"><div class="caja-cubierta"></div></div>`, '', 'vista-panel') +
        panel('grabados', usaImagen ? 'Imagen' : 'Sin imagen', usaImagen ? (p.cubierta.imagen ? 'elegida por ti' : 'sorteada') : 'tipográfica', `${usaImagen ? `<div class="ficha-grabado"></div><div class="fila-botones"><button class="boton chico" data-r="archivo">Elegir en el archivo</button>${p.cubierta.imagen ? '<button class="boton chico" data-r="sortear">Volver a sortear</button>' : ''}</div><div class="sub">Otras posibles</div>${sugerencias()}` : '<p class="nota">Este sistema compone la cubierta solo con letras. Prueba otra colección si quieres imagen.</p>'}
          ${c.generador === 'foto' ? `<div class="sub">Tu fotografía</div><p class="nota">Se convierte en semitono a dos tintas. Queda guardada dentro del proyecto.</p><div class="fila-botones"><button class="boton chico" data-r="foto">${p.cubierta.foto ? 'Cambiar la foto' : 'Agregar una foto'}</button>${p.cubierta.foto ? '<button class="boton chico" data-r="sin-foto">Quitarla</button>' : ''}</div>` : ''}
          <div class="sub">Comprobación</div><ul class="lista avisos-cubierta"></ul>`, App.seguir(5, 'Preparar impresión →')),
    };
  }
  function montar(m) {
    m.addEventListener('click', e => {
      const t = e.target;
      const col = t.closest('[data-col]'); if (col) return Folio.cambiar('coleccion', p => { p.coleccion = col.dataset.col; p.cubierta.paleta = 0; });
      const pa = t.closest('[data-paleta]'); if (pa) return Folio.cambiar('cubierta:paleta', p => { p.cubierta.paleta = +pa.dataset.paleta; });
      const md = t.closest('[data-modo]'); if (md) { modo = md.dataset.modo; return App.refrescar(); }
      const lam = t.closest('[data-lam]'); if (lam) return Folio.cambiar('cubierta:imagen', p => { p.cubierta.imagen = lam.dataset.lam; });
      const ver = t.closest('[data-ver]'); if (ver) return Archivo.abrir({ ficha: ver.dataset.ver });
      const r = t.closest('[data-r]'); if (!r) return;
      if (r.dataset.r === 'variar') Folio.cambiar('cubierta:variar', p => { p.cubierta.semilla = (p.cubierta.semilla % 100000) + 1 + Math.floor(Math.random() * 997); });
      if (r.dataset.r === 'archivo') Archivo.abrir({ modo: 'cubierta' });
      if (r.dataset.r === 'sortear') Folio.cambiar('cubierta:imagen', p => { p.cubierta.imagen = null; });
      if (r.dataset.r === 'sin-foto') Folio.cambiar('cubierta:foto', p => { p.cubierta.foto = null; });
      if (r.dataset.r === 'foto') {
        const inp = document.getElementById('entrada-imagen'); inp.value = '';
        inp.onchange = async () => { const f = inp.files[0]; if (!f) return; const nombre = 'foto-' + Date.now() + '.' + (f.name.split('.').pop() || 'jpg').toLowerCase(); Folio.recursos[nombre] = await App.leerDataURL(f); Folio.cambiar('cubierta:foto', p => { p.cubierta.foto = nombre; }); };
        inp.click();
      }
    });
    m.addEventListener('input', e => {
      if (e.target.dataset.esc) Folio.cambiar('cubierta:titulo', p => { p.cubierta.escalaTitulo = +e.target.value; }, { agrupar: true });
      if (e.target.dataset.k === 'numero') Folio.cambiar('cubierta:numero', p => { p.numero = e.target.value; }, { agrupar: true });
    });
    requestAnimationFrame(dibujar);
  }
  let tDib = null;
  App.registrar({
    indice: 4, n: 'V', nombre: 'Cubierta',
    estado: () => `${Folio.coleccion().nombre} ${Folio.p.numero}`,
    render, montar,
    alCambiar(motivo) { if (motivo === 'cubierta:titulo' || motivo === 'cubierta:numero') { clearTimeout(tDib); tDib = setTimeout(dibujar, 120); return false; } },
    _ultimo: () => ultimo, dibujar,
  });
  addEventListener('resize', () => { if (App.actual === 4) dibujar(); });
})();
