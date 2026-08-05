const { contextBridge, ipcRenderer } = require('electron');

// Expose protected window.api object to React renderer process
contextBridge.exposeInMainWorld('api', {
    // Window Control Actions
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    // Event Listeners for Device/System Events
    onDeviceStatusChanged: (callback) => {
        ipcRenderer.on('device-status-changed', (event, data) => callback(data));
    },
    onNotificationReceived: (callback) => {
        ipcRenderer.on('notification-received', (event, data) => callback(data));
    },
    onCallStateChanged: (callback) => {
        ipcRenderer.on('call-state-changed', (event, data) => callback(data));
    },

    // General IPC Send / Invoke Bridge
    send: (channel, data) => {
        const validChannels = ['send-sms', 'dismiss-notification', 'answer-call', 'decline-call'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    invoke: (channel, data) => {
        const validChannels = ['get-device-info', 'fetch-photos', 'fetch-files'];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        }
    }
});
