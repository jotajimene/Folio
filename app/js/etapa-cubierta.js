/* Folio · etapa V · Cubierta */
(function () {
  'use strict';
  const { esc, panel } = App;
  let modo = 'frente', ultimo = null, turno = 0, verPaletas = false;
  const NOMBRE_GEN = { grabado: 'grabado clásico', teselacion: 'caleidoscopio', foto: 'foto en semitono', umbral: 'color plano y recorte', cenefas: 'friso', detalle: 'detalle ampliado', reticula: 'retícula de hierbas', texto: 'textura de texto', puntos: 'constelación' };
  const SIN_IMAGEN = ['texto', 'puntos'];

  async function dibujar() {
    const caja = document.querySelector('.caja-cubierta'); if (!caja) return;
    const t = ++turno;
    await ARCHIVO.cargar();
    const p = Folio.p;
    const r = await Cubiertas.imprimible(p, { modo, k: 3.2, recursos: Folio.recursos, paginas: (p.composicion && p.composicion.paginas) || estimarPaginas(), logo: Perfil.datos.logo });
    if (t !== turno) return;
    ultimo = r;
    const raiz = caja.shadowRoot || caja.attachShadow({ mode: 'open' });
    raiz.innerHTML = `<style>${r.css.replace(/@page[^}]*}/, '')} :host{display:block} .cub{box-shadow:5px 5px 0 #1b1612;outline:2px solid #1b1612}</style>${r.html}`;
    const cont = caja.parentElement, mmPx = 96 / 25.4;
    const k = Math.min((cont.clientWidth - 20) / (r.mm[0] * mmPx), (cont.clientHeight - 20) / (r.mm[1] * mmPx));
    caja.style.zoom = Math.max(.2, k);
    const av = document.querySelector('.avisos-cubierta');
    if (av) av.innerHTML = r.avisos.map(a => `<li class="mal">${esc(a)}</li>`).join('') + (modo === 'extendida' ? `<li>Lomo <span>${String(r.medidas.lomo).replace('.', ',')} mm</span></li><li>Pliego de cubierta <span>${r.mm.map(x => Math.round(x * 10) / 10).join(' × ')} mm</span></li>` : '') || '<li>Todo en orden <span>✓</span></li>';
    const fi = document.querySelector('.ficha-grabado'); if (fi) fi.innerHTML = fichaHTML(r.laminas);
    if (Folio.coleccion().generador === 'detalle') pintarEncuadre(r);
  }
  function estimarPaginas() { const pal = Folio.p.bloques.reduce((a, b) => a + (b.texto.match(/\S+/g) || []).length, 0); return Math.max(16, Math.ceil(pal / 260) + 8); }
  function fichaHTML(ids) {
    if (!ids || !ids.length) return '<p class="nota">Este diseño no usa grabados en esta variación.</p>';
    return ids.slice(0, 3).map(id => { if (String(id).startsWith('recurso:')) return `<div class="ficha-mini"><img src="${Folio.recursos[id.slice(8)] || ''}" alt=""><div><b>Imagen tuya</b><small>guardada en el proyecto</small></div></div>`; const f = ARCHIVO.ficha(id); if (!f) return ''; return `<div class="ficha-mini"><img src="${ARCHIVO.mini(id)}" alt=""><div><b>${esc(f.fuente.obra || f.fuente.nombre)}</b><small>${esc(f.pagina.a)}${f.pagina.y ? ' · ' + f.pagina.y : ''} · ${esc(f.pagina.l || '')}</small><button class="enlace" data-ver="${id}">ver el original</button></div></div>`; }).join('') + (ids.length > 3 ? `<p class="nota">y ${ids.length - 3} más.</p>` : '');
  }
  // encuadre del fragmento: la lámina completa con un marco que se arrastra
  function pintarEncuadre(r) {
    const box = document.querySelector('.encuadre'); if (!box || !r.laminas[0]) return;
    const id0 = r.laminas[0], propia = String(id0).startsWith('recurso:');
    const l = propia ? { id: id0, w: (Folio.p.cubierta.imagenDims || [1000, 1000])[0], h: (Folio.p.cubierta.imagenDims || [1000, 1000])[1] } : ARCHIVO.porId[id0], rc = r.recorte; if (!l || !rc) return;
    const aspecto = (r.medidas.W + r.medidas.s) / (r.medidas.H + 2 * r.medidas.s);
    let sw = l.w / rc.z, sh = sw / aspecto; if (sh > l.h) { sh = l.h; sw = sh * aspecto; }
    box.innerHTML = `<img src="${propia ? Folio.recursos[id0.slice(8)] : ARCHIVO.src(l.id)}" alt="" draggable="false"><i class="marco-encuadre" style="left:${(rc.x * l.w - sw / 2) / l.w * 100}%;top:${(rc.y * l.h - sh / 2) / l.h * 100}%;width:${sw / l.w * 100}%;height:${sh / l.h * 100}%"></i>`;
    const z = document.querySelector('[data-zoomfrag]'); if (z) { z.max = Cubiertas.Fragmento.zMax(l).toFixed(2); z.value = rc.z; }
  }
  function sugerencias() {
    if (!ARCHIVO.listo) return '';
    const gen = Folio.coleccion().generador;
    const filtro = gen === 'reticula' ? (l => l.hb) : gen === 'detalle' ? (l => l.q && l.w >= 500) : (l => l.q && l.tipo === 'figura' && l.w > 260 && l.h > 260);
    const s = ARCHIVO.elegir(filtro, Folio.p.cubierta.semilla * 31 + 5, 9);
    return `<div class="miniaturas">${s.map(l => `<button data-lam="${l.id}" class="${Folio.p.cubierta.imagen === l.id ? 'on' : ''}"><img src="${ARCHIVO.mini(l.id)}" alt="" loading="lazy"></button>`).join('')}</div>`;
  }
  const muestra = pl => `background:linear-gradient(135deg,${pl[0]} 0 50%,${pl[1]} 50% 75%,${pl[2]} 75%)`;
  function paletasHTML() {
    const p = Folio.p, c = Folio.coleccion(), actual = (p.cubierta.colores || c.paletas[(p.cubierta.paleta || 0) % c.paletas.length]).join();
    const btn = (pl, attrs, titulo) => `<button class="${pl.join() === actual ? 'on' : ''}" ${attrs} title="${esc(titulo)}" style="${muestra(pl)}"></button>`;
    const propias = Perfil.datos.paletas || [];
    let h = `<div class="paleta">${c.paletas.map((pl, i) => btn(pl, `data-paleta="${i}"`, 'De la colección')).join('')}</div>`;
    if (propias.length) h += `<div class="sub">Tus paletas</div><div class="paleta">${propias.map((x, i) => btn(x.colores, `data-colores="${x.colores.join(',')}"`, x.nombre) + `<button class="quitar-paleta" data-quitar-paleta="${i}" title="Quitar">×</button>`).join('')}</div>`;
    h += `<button class="enlace" data-r="mas-paletas">${verPaletas ? 'Ocultar la biblioteca de paletas' : 'Ver más paletas'}</button>`;
    if (verPaletas) h += `<div class="paleta biblioteca">${Folio.PALETAS.map(([n, ...pl]) => btn(pl, `data-colores="${pl.join(',')}"`, n)).join('')}</div>`;
    const cur = actual.split(',');
    h += `<details class="propia"><summary>Armar una paleta propia</summary><div class="colores-propios"><label>Fondo <input type="color" data-propio="0" value="${cur[0]}"></label><label>Tinta <input type="color" data-propio="1" value="${cur[1]}"></label><label>Acento <input type="color" data-propio="2" value="${cur[2]}"></label></div><button class="boton chico" data-r="guardar-paleta">Guardar en mis paletas</button></details>`;
    return h;
  }
  function render() {
    const p = Folio.p, c = Folio.coleccion();
    const usaImagen = !SIN_IMAGEN.includes(c.generador);
    const fragmento = c.generador === 'detalle';
    return {
      cols: '280px 1fr 300px',
      html: panel('sistema', 'Colección', c.nombre, `<div class="colecciones compacta">${Folio.COLECCIONES.map((x, i) => `<button class="coleccion ${x.id === p.coleccion ? 'on' : ''}" data-col="${x.id}" title="${esc(x.descripcion)}"><span class="muestra" style="font-family:${x.titulos}">Aa</span><span><b>${String(i + 1).padStart(2, '0')} ${esc(x.nombre)}</b><small>${esc(x.lema)}</small></span></button>`).join('')}</div>
        <p class="nota">${esc(c.descripcion)}</p>
        <div class="campos" style="grid-template-columns:1fr auto"><label class="campo"><span>Número en la colección</span><input data-k="numero" value="${esc(p.numero)}"></label><button class="boton chico" data-r="siguiente" style="align-self:end;margin-bottom:8px" title="El siguiente libre según tu perfil">Siguiente: ${Perfil.siguiente(p.coleccion)}</button></div>
        <div class="sub">Paleta</div>${paletasHTML()}
        <button class="boton" data-r="variar" style="width:100%;margin-top:8px">↻ Otra variación</button>
        <label class="ajuste"><span>Tamaño del título</span><input type="range" min="0.6" max="1.6" step="0.05" value="${p.cubierta.escalaTitulo || 1}" data-esc="1"></label>`) +
        panel('cubierta', 'La cubierta', modo === 'frente' ? `frente · ${p.formato}` : 'extendida: contracubierta, lomo y frente', `<div class="fila-botones centrada"><button class="boton chico ${modo === 'frente' ? 'taco' : ''}" data-modo="frente">Frente</button><button class="boton chico ${modo === 'extendida' ? 'taco' : ''}" data-modo="extendida">Extendida con lomo</button></div><div class="escenario-cubierta"><div class="caja-cubierta"></div></div>`, '', 'vista-panel') +
        panel('grabados', usaImagen ? 'Imagen' : 'Sin imagen', usaImagen ? (p.cubierta.imagen ? 'elegida por ti' : 'sorteada') : 'tipográfica', `${fragmento ? `<div class="sub">Encuadre del fragmento</div><div class="encuadre" title="Arrastra el marco para elegir el detalle"></div><label class="ajuste"><span>Acercamiento</span><input type="range" min="1" max="6" step="0.05" data-zoomfrag="1"></label><p class="nota">El acercamiento tiene un tope para que la imagen no se vea pixelada.</p>` : ''}
          ${usaImagen ? `<div class="ficha-grabado"></div><div class="fila-botones"><button class="boton chico" data-r="archivo">Elegir en el archivo</button><button class="boton chico" data-r="propia">Una imagen tuya</button>${p.cubierta.imagen ? '<button class="boton chico" data-r="sortear">Volver a sortear</button>' : ''}</div><div class="sub">Otras posibles</div>${sugerencias()}` : '<p class="nota">Este diseño compone la cubierta solo con letras.</p>'}
          ${c.generador === 'foto' ? `<div class="sub">Tu fotografía</div><p class="nota">Se convierte en semitono a dos tintas y corre por toda la tapa. Queda guardada dentro del proyecto.</p><div class="fila-botones"><button class="boton chico" data-r="foto">${p.cubierta.foto ? 'Cambiar la foto' : 'Agregar una foto'}</button>${p.cubierta.foto ? '<button class="boton chico" data-r="sin-foto">Quitarla</button>' : ''}</div>` : ''}
          <div class="sub">Comprobación</div><ul class="lista avisos-cubierta"></ul>`, App.seguir(5, 'Preparar impresión →')),
    };
  }
  function montar(m) {
    m.addEventListener('click', async e => {
      const t = e.target;
      const col = t.closest('[data-col]'); if (col) return Folio.cambiar('coleccion', p => { p.coleccion = col.dataset.col; p.cubierta.paleta = 0; p.cubierta.colores = null; p.cubierta.recorte = null; });
      const pa = t.closest('[data-paleta]'); if (pa) return Folio.cambiar('cubierta:paleta', p => { p.cubierta.paleta = +pa.dataset.paleta; p.cubierta.colores = null; });
      const co = t.closest('[data-colores]'); if (co) return Folio.cambiar('cubierta:paleta', p => { p.cubierta.colores = co.dataset.colores.split(','); });
      const qp = t.closest('[data-quitar-paleta]'); if (qp) { Perfil.datos.paletas.splice(+qp.dataset.quitarPaleta, 1); await Perfil.guardar(); return App.refrescar(); }
      const md = t.closest('[data-modo]'); if (md) { modo = md.dataset.modo; return App.refrescar(); }
      const lam = t.closest('[data-lam]'); if (lam) return Folio.cambiar('cubierta:imagen', p => { p.cubierta.imagen = lam.dataset.lam; p.cubierta.recorte = null; });
      const ver = t.closest('[data-ver]'); if (ver) return Archivo.abrir({ ficha: ver.dataset.ver });
      const r = t.closest('[data-r]'); if (!r) return;
      switch (r.dataset.r) {
        case 'variar': return Folio.cambiar('cubierta:variar', p => { p.cubierta.semilla = (p.cubierta.semilla % 100000) + 1 + Math.floor(Math.random() * 997); p.cubierta.recorte = null; });
        case 'archivo': return Archivo.abrir({ modo: 'cubierta' });
        case 'propia': { const im = await Imagenes.agregar({ titulo: 'Imagen para la tapa' }); if (im) Folio.cambiar('cubierta:imagen', p => { p.cubierta.imagen = 'recurso:' + im.nombre; p.cubierta.imagenDims = [im.w, im.h]; p.cubierta.recorte = null; }); return; }
        case 'sortear': return Folio.cambiar('cubierta:imagen', p => { p.cubierta.imagen = null; p.cubierta.recorte = null; });
        case 'sin-foto': return Folio.cambiar('cubierta:foto', p => { p.cubierta.foto = null; });
        case 'siguiente': return Folio.cambiar('cubierta:siguiente', p => { p.numero = Perfil.siguiente(p.coleccion); });
        case 'mas-paletas': verPaletas = !verPaletas; return App.refrescar();
        case 'guardar-paleta': {
          const colores = [...m.querySelectorAll('[data-propio]')].map(i => i.value);
          const nombre = await App.modal({ titulo: 'Guardar la paleta', cuerpo: `<label class="campo"><span>Nombre</span><input class="nombre-paleta" value="Paleta ${(Perfil.datos.paletas || []).length + 1}"></label>`, botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Guardar', taco: true, valor: c => c.querySelector('.nombre-paleta').value }] });
          if (!nombre) return;
          Perfil.datos.paletas = [...(Perfil.datos.paletas || []), { nombre, colores }]; await Perfil.guardar();
          return Folio.cambiar('cubierta:paleta', p => { p.cubierta.colores = colores; });
        }
        case 'foto': {
          const inp = document.getElementById('entrada-imagen'); inp.value = '';
          inp.onchange = async () => { const f = inp.files[0]; if (!f) return; const nombre = 'foto-' + Date.now() + '.' + (f.name.split('.').pop() || 'jpg').toLowerCase(); Folio.recursos[nombre] = await App.leerDataURL(f); Folio.cambiar('cubierta:foto', p => { p.cubierta.foto = nombre; }); };
          return inp.click();
        }
      }
    });
    m.addEventListener('input', e => {
      if (e.target.dataset.esc) Folio.cambiar('cubierta:titulo', p => { p.cubierta.escalaTitulo = +e.target.value; }, { agrupar: true });
      if (e.target.dataset.k === 'numero') Folio.cambiar('cubierta:numero', p => { p.numero = e.target.value; }, { agrupar: true });
      if (e.target.dataset.propio) { const colores = [...m.querySelectorAll('[data-propio]')].map(i => i.value); Folio.cambiar('cubierta:colores', p => { p.cubierta.colores = colores; }, { agrupar: true }); }
      if (e.target.dataset.zoomfrag && ultimo && ultimo.recorte) { const rc = { ...ultimo.recorte, z: +e.target.value }; Folio.cambiar('cubierta:recorte', p => { p.cubierta.recorte = rc; }, { agrupar: true }); }
    });
    // arrastrar el marco del encuadre
    m.addEventListener('pointerdown', e => {
      const box = e.target.closest('.encuadre'); if (!box || !ultimo || !ultimo.recorte) return;
      e.preventDefault(); const R = box.getBoundingClientRect();
      const mover = ev => { const x = Math.max(0, Math.min(1, (ev.clientX - R.left) / R.width)), y = Math.max(0, Math.min(1, (ev.clientY - R.top) / R.height)); const rc = { ...ultimo.recorte, x, y }; ultimo.recorte = rc; const mk = box.querySelector('.marco-encuadre'); if (mk) { mk.style.left = `calc(${x * 100}% - ${mk.style.width} / 2)`; mk.style.top = `calc(${y * 100}% - ${mk.style.height} / 2)`; } };
      const soltar = ev => { removeEventListener('pointermove', mover); removeEventListener('pointerup', soltar); mover(ev); Folio.cambiar('cubierta:recorte', p => { p.cubierta.recorte = { ...ultimo.recorte }; }); };
      addEventListener('pointermove', mover); addEventListener('pointerup', soltar); mover(e);
    });
    requestAnimationFrame(dibujar);
  }
  let tDib = null;
  App.registrar({
    indice: 4, n: 'V', nombre: 'Cubierta',
    estado: () => `${Folio.coleccion().nombre} ${Folio.p.numero}`,
    render, montar,
    alCambiar(motivo) { if (['cubierta:titulo', 'cubierta:numero', 'cubierta:colores', 'cubierta:recorte'].includes(motivo)) { clearTimeout(tDib); tDib = setTimeout(dibujar, 140); return false; } },
    _ultimo: () => ultimo, dibujar, _modo: v => { modo = v; },
  });
  addEventListener('resize', () => { if (App.actual === 4) dibujar(); });
})();
