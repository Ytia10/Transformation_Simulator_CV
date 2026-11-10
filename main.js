const { app, BrowserWindow } = require('electron');
const path = require('path');
function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 950,
    autoHideMenuBar: true,
    webPreferences: { 
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false
    }
  });
  win.loadFile(path.join(__dirname, 'dist/index.html'));
  
  // win.webContents.openDevTools(); // Uncomment if you need to debug further
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
