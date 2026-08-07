const { ipcMain, EventEmitter } = require('electron');
const CryptoHelper = require('../kdeconnect/CryptoHelper');
const DeviceManager = require('../kdeconnect/DeviceManager');
const Device = require('../kdeconnect/Device');
const PacketRouter = require('../kdeconnect/PacketRouter');
const PairingManager = require('../kdeconnect/PairingManager');

// Phase 3 Plugins
const NotificationPlugin = require('../kdeconnect/plugins/NotificationPlugin');
const BatteryPlugin = require('../kdeconnect/plugins/BatteryPlugin');
const ConnectivityPlugin = require('../kdeconnect/plugins/ConnectivityPlugin');
const ClipboardPlugin = require('../kdeconnect/plugins/ClipboardPlugin');
const MprisPlugin = require('../kdeconnect/plugins/MprisPlugin');
const FindMyPhonePlugin = require('../kdeconnect/plugins/FindMyPhonePlugin');
const RunCommandPlugin = require('../kdeconnect/plugins/RunCommandPlugin');

let cryptoHelper = null;
let deviceManager = null;
let packetRouter = null;
let pairingManager = null;
let activeDeviceConnections = new Map(); // deviceId -> Device instance

// Plugin Instances
let notificationPlugin = null;
let batteryPlugin = null;
let connectivityPlugin = null;
let clipboardPlugin = null;
let mprisPlugin = null;
let findMyPhonePlugin = null;
let runCommandPlugin = null;

function initKDEConnectBridge(mainWindow) {
    console.log('[KDEConnect Bridge] Initializing KDE Connect Protocol Engine & Feature Plugins...');

    const pluginEvents = new EventEmitter();

    cryptoHelper = new CryptoHelper();
    deviceManager = new DeviceManager(cryptoHelper);
    packetRouter = new PacketRouter();
    pairingManager = new PairingManager(packetRouter, cryptoHelper);

    // Instantiate Plugins
    notificationPlugin = new NotificationPlugin(pluginEvents);
    batteryPlugin = new BatteryPlugin(pluginEvents);
    connectivityPlugin = new ConnectivityPlugin(pluginEvents);
    clipboardPlugin = new ClipboardPlugin(pluginEvents);
    mprisPlugin = new MprisPlugin(pluginEvents);
    findMyPhonePlugin = new FindMyPhonePlugin(pluginEvents);
    runCommandPlugin = new RunCommandPlugin(pluginEvents);

    // Register Plugins in PacketRouter
    packetRouter.registerPlugin(notificationPlugin);
    packetRouter.registerPlugin(batteryPlugin);
    packetRouter.registerPlugin(connectivityPlugin);
    packetRouter.registerPlugin(clipboardPlugin);
    packetRouter.registerPlugin(mprisPlugin);
    packetRouter.registerPlugin(findMyPhonePlugin);
    packetRouter.registerPlugin(runCommandPlugin);

    // Start UDP discovery
    deviceManager.startDiscovery();

    // Forward Discovered Devices to UI
    deviceManager.on('deviceDiscovered', (deviceInfo) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('discovered-devices-changed', deviceManager.getDiscoveredDevices());
        }

        if (pairingManager.isPaired(deviceInfo.id) && !activeDeviceConnections.has(deviceInfo.id)) {
            connectToDevice(deviceInfo, mainWindow);
        }
    });

    // Forward Plugin Events to React Renderer
    pluginEvents.on('notificationReceived', (notifData) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('notification-received', notifData);
        }
    });

    pluginEvents.on('batteryStateChanged', (batteryState) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('device-status-changed', { battery: batteryState.charge, isCharging: batteryState.isCharging });
        }
    });

    pluginEvents.on('connectivityStateChanged', (connState) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('device-status-changed', { signal: connState.signalStrength });
        }
    });

    pluginEvents.on('clipboardReceived', (clipItem) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('clipboard-received', clipItem);
        }
    });

    pluginEvents.on('mediaStateChanged', (mediaState) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('media-state-changed', mediaState);
        }
    });

    // IPC Handlers for UI Action Requests
    ipcMain.on('send-reply', (event, { requestReplyId, text }) => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) {
            notificationPlugin.replyToNotification(activeDev, requestReplyId, text);
        }
    });

    ipcMain.on('dismiss-notification', (event, { id }) => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) {
            notificationPlugin.dismissNotification(activeDev, id);
        }
    });

    ipcMain.on('send-clipboard', (event, { content }) => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) {
            clipboardPlugin.sendClipboard(activeDev, content);
        }
    });

    ipcMain.on('media-control', (event, { action, volume }) => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) {
            if (action === 'setVolume') {
                mprisPlugin.setVolume(activeDev, volume);
            } else {
                mprisPlugin.sendAction(activeDev, action);
            }
        }
    });

    ipcMain.on('ring-phone', () => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) {
            findMyPhonePlugin.ringPhone(activeDev);
        }
    });

    ipcMain.handle('get-discovered-devices', () => deviceManager.getDiscoveredDevices());

    ipcMain.handle('pair-device', (event, deviceId) => {
        const devInfo = deviceManager.discoveredDevices.get(deviceId);
        if (!devInfo) return { success: false, message: 'Device not found' };

        let devConn = activeDeviceConnections.get(deviceId);
        if (!devConn) devConn = connectToDevice(devInfo, mainWindow);

        pairingManager.requestPair(devConn);
        return { success: true };
    });

    return { cryptoHelper, deviceManager, packetRouter, pairingManager };
}

function getFirstActiveDevice() {
    const values = Array.from(activeDeviceConnections.values());
    return values.length > 0 ? values[0] : null;
}

function connectToDevice(deviceInfo, mainWindow) {
    const deviceConnection = new Device(deviceInfo, cryptoHelper);

    deviceConnection.on('connected', (info) => {
        activeDeviceConnections.set(info.id, deviceConnection);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('device-status-changed', {
                name: info.name,
                connected: true,
                battery: batteryPlugin ? batteryPlugin.batteryState.charge : 85,
                signal: connectivityPlugin ? connectivityPlugin.connectivityState.signalStrength : 4,
                wifi: true,
                bluetooth: true
            });
        }

        // Request initial state from device
        notificationPlugin.requestAllNotifications(deviceConnection);
        batteryPlugin.requestBatteryStatus(deviceConnection);
        connectivityPlugin.requestReport(deviceConnection);
    });

    deviceConnection.on('packet', (packet) => {
        packetRouter.routePacket(deviceConnection, packet);
    });

    deviceConnection.on('disconnected', ({ info }) => {
        activeDeviceConnections.delete(info.id);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('device-status-changed', { name: info.name, connected: false });
        }
    });

    deviceConnection.connect();
    return deviceConnection;
}

module.exports = { initKDEConnectBridge };
