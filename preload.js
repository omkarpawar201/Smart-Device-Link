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
    onDiscoveredDevicesChanged: (callback) => {
        ipcRenderer.on('discovered-devices-changed', (event, data) => callback(data));
    },
    onPairingRequested: (callback) => {
        ipcRenderer.on('pairing-requested', (event, data) => callback(data));
    },
    onNotificationReceived: (callback) => {
        ipcRenderer.on('notification-received', (event, data) => callback(data));
    },
    onClipboardReceived: (callback) => {
        ipcRenderer.on('clipboard-received', (event, data) => callback(data));
    },
    onMediaStateChanged: (callback) => {
        ipcRenderer.on('media-state-changed', (event, data) => callback(data));
    },
    onIncomingCall: (callback) => {
        ipcRenderer.on('incoming-call', (event, data) => callback(data));
    },
    onSmsThreadsUpdated: (callback) => {
        ipcRenderer.on('sms-threads-updated', (event, data) => callback(data));
    },
    onContactsUpdated: (callback) => {
        ipcRenderer.on('contacts-updated', (event, data) => callback(data));
    },
    onPhotosUpdated: (callback) => {
        ipcRenderer.on('photos-updated', (event, data) => callback(data));
    },

    // General IPC Send / Invoke Bridge
    send: (channel, data) => {
        const validChannels = [
            'send-reply',
            'dismiss-notification',
            'send-clipboard',
            'media-control',
            'ring-phone',
            'send-sms',
            'fetch-contacts',
            'share-url',
            'dial-number',
            'download-file',
            'upload-file',
            'delete-file',
            'scan-photos',
            'answer-call-audio',
            'hangup-call-audio',
            'toggle-mute-audio',
            'transfer-call-audio'
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    invoke: (channel, data) => {
        const validChannels = [
            'get-discovered-devices',
            'pair-device',
            'accept-pair',
            'unpair-device',
            'fetch-files'
        ];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        }
    }
});
