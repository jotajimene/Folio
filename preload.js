// Puente seguro entre la interfaz y el sistema (sin acceso directo a Node).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('Escritorio', {
  guardarProyecto: (ruta, datos, como) => ipcRenderer.invoke('proyecto:guardar', { ruta, datos, como }),
  abrirProyecto: ruta => ipcRenderer.invoke('proyecto:abrir', ruta),
  autoguardar: datos => ipcRenderer.invoke('proyecto:autoguardar', datos),
  recuperar: () => ipcRenderer.invoke('proyecto:recuperar'),
  guardarArchivo: (nombre, b64, filtros) => ipcRenderer.invoke('archivo:guardar', { nombre, b64, filtros }),
  pdf: (trabajo, nombre) => ipcRenderer.invoke('pdf:generar', { trabajo, nombre }),
  tapaPNG: trabajo => ipcRenderer.invoke('cubierta:png', trabajo),
  pdfA: (trabajo, ruta) => ipcRenderer.invoke('pdf:generar-a', { trabajo, ruta }),
  perfil: () => ipcRenderer.invoke('perfil:leer'),
  guardarPerfil: d => ipcRenderer.invoke('perfil:guardar', d),
  elegirArchivo: (titulo, filtros, multiple) => ipcRenderer.invoke('archivo:elegir', { titulo, filtros, multiple }),
  modelo: {
    estado: () => ipcRenderer.invoke('modelo:estado'),
    descargar: id => ipcRenderer.invoke('modelo:descargar', id),
    cancelarDescarga: () => ipcRenderer.invoke('modelo:cancelar-descarga'),
    borrar: id => ipcRenderer.invoke('modelo:borrar', id),
    generar: opts => ipcRenderer.invoke('modelo:generar', opts),
    detener: pedido => ipcRenderer.invoke('modelo:detener', pedido),
    alProgreso: f => ipcRenderer.on('modelo:progreso', (_e, d) => f(d)),
    alTrozo: f => ipcRenderer.on('modelo:trozo', (_e, d) => f(d)),
  },
  externo: url => ipcRenderer.invoke('externo', url),
  mostrar: ruta => ipcRenderer.invoke('mostrar-en-carpeta', ruta),
  alMenu: f => ipcRenderer.on('menu', (_e, accion) => f(accion)),
});
