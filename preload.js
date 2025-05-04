/*jshint esversion: 6 */
const {
    contextBridge,
    ipcRenderer
} = require("electron");
// Try resolving the path explicitly -- REVERTED
// const vegaEmbedPath = require.resolve('vega-embed');
// const vegaEmbed = require(vegaEmbedPath);

contextBridge.exposeInMainWorld(
    "api", {
        send: (channel, data) => {
            ipcRenderer.send(channel, data);
        },
        receive: (channel, func) => {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        },
    }
);

// Expose vegaEmbed to the renderer process -- REVERTED
/*
contextBridge.exposeInMainWorld(
    'vegaEmbedApi',
    {
        embed: (element, spec, options) => vegaEmbed(element, spec, options)
    }
);
*/