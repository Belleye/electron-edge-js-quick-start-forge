process.env['ELECTRON_DISABLE_SECURITY_WARNINGS']=true
const {app, BrowserWindow, ipcMain} = require("electron");
const runner = require('./app.js')
const fs = require('fs');
const path = require('path');

var version = 'core';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 750,
    webPreferences:{
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
      preload: `${__dirname}/preload.js`,
    }
  });

  // and load the index.html of the app.
  mainWindow.loadURL(`file://${__dirname}/index.html?version=${version}&electron=${process.versions.electron}`);

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  //if (process.platform !== 'darwin') {
    app.quit()
  //}
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.on("run", (event, args) => {
  runner.run(mainWindow);
});

// Add listener for the reload SQL message from renderer
ipcMain.on("runSql", (event, args) => {
  if (mainWindow) {
    console.log('Received runSql message, executing SQL query...');
    runner.executeSqlAndSendResult(mainWindow);
  } else {
    console.error('Cannot run SQL query, mainWindow is not defined.');
  }
});

// Add listener to load and send Vega spec
ipcMain.on('getVegaSpec', (event) => {
  const specPath = path.join(__dirname, 'src', 'public', 'Visual.vg.json');
  fs.readFile(specPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading Vega spec file:', err);
      event.reply('vegaSpecData', { error: 'Failed to load Vega spec.' });
      return;
    }
    try {
      const spec = JSON.parse(data);
      event.reply('vegaSpecData', { spec });
    } catch (parseErr) {
      console.error('Error parsing Vega spec JSON:', parseErr);
      event.reply('vegaSpecData', { error: 'Failed to parse Vega spec JSON.' });
    }
  });
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
