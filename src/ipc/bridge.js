const { ipcMain } = require('electron');
const CryptoHelper = require('../kdeconnect/CryptoHelper');
const DeviceManager = require('../kdeconnect/DeviceManager');
const Device = require('../kdeconnect/Device');
const PacketRouter = require('../kdeconnect/PacketRouter');
const PairingManager = require('../kdeconnect/PairingManager');

let cryptoHelper = null;
let deviceManager = null;
let packetRouter = null;
let pairingManager = null;
let activeDeviceConnections = new Map(); // deviceId -> Device instance

function initKDEConnectBridge(mainWindow) {
    console.log('[KDEConnect Bridge] Initializing KDE Connect Protocol Engine...');

    cryptoHelper = new CryptoHelper();
    deviceManager = new DeviceManager(cryptoHelper);
    packetRouter = new PacketRouter();
    pairingManager = new PairingManager(packetRouter, cryptoHelper);

    // Start UDP discovery
    deviceManager.startDiscovery();

    // Handle Discovered Devices
    deviceManager.on('deviceDiscovered', (deviceInfo) => {
        console.log(`[Bridge] Device Discovered: ${deviceInfo.name} (${deviceInfo.ip})`);

        // Send updated device list to UI
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('discovered-devices-changed', deviceManager.getDiscoveredDevices());
        }

        // Auto-connect if device is paired
        if (pairingManager.isPaired(deviceInfo.id) && !activeDeviceConnections.has(deviceInfo.id)) {
            connectToDevice(deviceInfo, mainWindow);
        }
    });

    // Pairing Event Forwarding to Renderer UI
    pairingManager.on('pairingRequested', ({ device, requestId }) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('pairing-requested', { device, requestId });
        }
    });

    pairingManager.on('devicePaired', (pairedDevice) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('device-status-changed', {
                name: pairedDevice.name,
                connected: true,
                paired: true
            });
        }
    });

    // IPC Handlers from Renderer UI
    ipcMain.handle('get-discovered-devices', () => {
        return deviceManager.getDiscoveredDevices();
    });

    ipcMain.handle('pair-device', (event, deviceId) => {
        const devInfo = deviceManager.discoveredDevices.get(deviceId);
        if (!devInfo) return { success: false, message: 'Device not found on LAN' };

        let devConnection = activeDeviceConnections.get(deviceId);
        if (!devConnection) {
            devConnection = connectToDevice(devInfo, mainWindow);
        }

        pairingManager.requestPair(devConnection);
        return { success: true, message: 'Pairing request sent to device' };
    });

    ipcMain.handle('accept-pair', (event, deviceId) => {
        const devConnection = activeDeviceConnections.get(deviceId);
        if (devConnection) {
            pairingManager.acceptPair(devConnection);
            return { success: true };
        }
        return { success: false };
    });

    ipcMain.handle('unpair-device', (event, deviceId) => {
        pairingManager.unpair(deviceId);
        const devConnection = activeDeviceConnections.get(deviceId);
        if (devConnection) {
            devConnection.disconnect();
            activeDeviceConnections.delete(deviceId);
        }
        return { success: true };
    });

    return {
        cryptoHelper,
        deviceManager,
        packetRouter,
        pairingManager
    };
}

function connectToDevice(deviceInfo, mainWindow) {
    const deviceConnection = new Device(deviceInfo, cryptoHelper);

    deviceConnection.on('connected', (info) => {
        activeDeviceConnections.set(info.id, deviceConnection);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('device-status-changed', {
                name: info.name,
                connected: true,
                battery: 85,
                signal: 4,
                wifi: true,
                bluetooth: true
            });
        }
    });

    deviceConnection.on('packet', (packet) => {
        packetRouter.routePacket(deviceConnection, packet);
    });

    deviceConnection.on('disconnected', ({ info }) => {
        activeDeviceConnections.delete(info.id);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('device-status-changed', {
                name: info.name,
                connected: false
            });
        }
    });

    deviceConnection.connect();
    return deviceConnection;
}

module.exports = { initKDEConnectBridge };
