// Puente seguro entre la interfaz y el sistema (sin acceso directo a Node).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('Escritorio', {
  guardarProyecto: (ruta, datos, como) => ipcRenderer.invoke('proyecto:guardar', { ruta, datos, como }),
  abrirProyecto: ruta => ipcRenderer.invoke('proyecto:abrir', ruta),
  autoguardar: datos => ipcRenderer.invoke('proyecto:autoguardar', datos),
  recuperar: () => ipcRenderer.invoke('proyecto:recuperar'),
  guardarArchivo: (nombre, b64, filtros) => ipcRenderer.invoke('archivo:guardar', { nombre, b64, filtros }),
  pdf: (trabajo, nombre) => ipcRenderer.invoke('pdf:generar', { trabajo, nombre }),
  pdfA: (trabajo, ruta) => ipcRenderer.invoke('pdf:generar-a', { trabajo, ruta }),
  externo: url => ipcRenderer.invoke('externo', url),
  mostrar: ruta => ipcRenderer.invoke('mostrar-en-carpeta', ruta),
  alMenu: f => ipcRenderer.on('menu', (_e, accion) => f(accion)),
});
