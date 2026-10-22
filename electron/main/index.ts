import { app, BrowserWindow, Menu } from 'electron';
import { join } from 'node:path';
import { initDb } from './db';
import { registerIpcHandlers } from './ipc-handlers';
import { registerImgSchemePrivileges, registerImgProtocol } from './protocol';

// El esquema privilegiado debe registrarse antes de que la app este lista.
registerImgSchemePrivileges();

// Proceso principal de Electron: crea la ventana, inicializa la base de datos
// y registra los manejadores IPC que atienden al renderer.

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Fuller Ofertas',
    backgroundColor: '#faf8f5',
    // Oculta la barra de menu nativa (File/Edit/View...) que no se usa.
    // Se conservan los controles de ventana (minimizar/maximizar/cerrar).
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Elimina por completo el menu de la aplicacion para que ni con Alt aparezca.
  mainWindow.setMenuBarVisibility(false);

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Quita el menu nativo global (en Windows/Linux elimina File/Edit/View...).
  Menu.setApplicationMenu(null);

  // Inicializa el almacen local antes de atender peticiones.
  initDb();
  registerImgProtocol();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
