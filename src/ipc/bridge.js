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

// Phase 4 Plugins
const TelephonyPlugin = require('../kdeconnect/plugins/TelephonyPlugin');
const SmsPlugin = require('../kdeconnect/plugins/SmsPlugin');
const ContactsPlugin = require('../kdeconnect/plugins/ContactsPlugin');
const SharePlugin = require('../kdeconnect/plugins/SharePlugin');

// Phase 5 Plugins
const SftpPlugin = require('../kdeconnect/plugins/SftpPlugin');

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
let telephonyPlugin = null;
let smsPlugin = null;
let contactsPlugin = null;
let sharePlugin = null;
let sftpPlugin = null;

function initKDEConnectBridge(mainWindow) {
    console.log('[KDEConnect Bridge] Initializing Protocol Engine & Storage Plugins...');

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
    telephonyPlugin = new TelephonyPlugin(pluginEvents);
    smsPlugin = new SmsPlugin(pluginEvents);
    contactsPlugin = new ContactsPlugin(pluginEvents);
    sharePlugin = new SharePlugin(pluginEvents);
    sftpPlugin = new SftpPlugin(pluginEvents);

    // Register Plugins in PacketRouter
    packetRouter.registerPlugin(notificationPlugin);
    packetRouter.registerPlugin(batteryPlugin);
    packetRouter.registerPlugin(connectivityPlugin);
    packetRouter.registerPlugin(clipboardPlugin);
    packetRouter.registerPlugin(mprisPlugin);
    packetRouter.registerPlugin(findMyPhonePlugin);
    packetRouter.registerPlugin(runCommandPlugin);
    packetRouter.registerPlugin(telephonyPlugin);
    packetRouter.registerPlugin(smsPlugin);
    packetRouter.registerPlugin(contactsPlugin);
    packetRouter.registerPlugin(sharePlugin);
    packetRouter.registerPlugin(sftpPlugin);

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
    pluginEvents.on('notificationReceived', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('notification-received', data);
    });

    pluginEvents.on('batteryStateChanged', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('device-status-changed', { battery: data.charge, isCharging: data.isCharging });
    });

    pluginEvents.on('connectivityStateChanged', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('device-status-changed', { signal: data.signalStrength });
    });

    pluginEvents.on('clipboardReceived', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('clipboard-received', data);
    });

    pluginEvents.on('mediaStateChanged', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('media-state-changed', data);
    });

    pluginEvents.on('incomingCall', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('incoming-call', data);
    });

    pluginEvents.on('smsThreadsUpdated', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('sms-threads-updated', data);
    });

    pluginEvents.on('contactsUpdated', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('contacts-updated', data);
    });

    // Phase 5 IPC Handlers
    ipcMain.handle('fetch-files', async (event, { path }) => {
        try {
            return await sftpPlugin.listDirectory(path || '/sdcard');
        } catch (e) {
            console.warn('[Bridge] fetch-files error:', e.message);
            return [];
        }
    });

    ipcMain.on('download-file', async (event, { remotePath, name }) => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) {
            const desktopPath = require('path').join(require('os').homedir(), 'Desktop', name);
            console.log(`[Bridge] Downloading ${remotePath} to ${desktopPath}...`);
            await sftpPlugin.downloadFile(remotePath, desktopPath);
        }
    });

    ipcMain.on('upload-file', async (event, { localPath, remoteDirectory }) => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) {
            const fileName = require('path').basename(localPath);
            const remotePath = `${remoteDirectory}/${fileName}`;
            console.log(`[Bridge] Uploading ${localPath} to ${remotePath}...`);
            await sftpPlugin.uploadFile(localPath, remotePath);
        }
    });

    ipcMain.on('delete-file', async (event, { remotePath, isDir }) => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) {
            await sftpPlugin.deleteItem(remotePath, isDir);
        }
    });

    ipcMain.on('send-sms', (event, { phoneNumber, messageText }) => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) smsPlugin.sendSms(activeDev, phoneNumber, messageText);
    });

    ipcMain.on('fetch-contacts', () => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) contactsPlugin.requestAllContacts(activeDev);
    });

    ipcMain.on('share-url', (event, { url }) => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) sharePlugin.shareUrlToPhone(activeDev, url);
    });

    ipcMain.on('dial-number', (event, { number }) => {
        console.log(`[Bridge] Dialing number: ${number}`);
    });

    ipcMain.on('send-reply', (event, { requestReplyId, text }) => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) notificationPlugin.replyToNotification(activeDev, requestReplyId, text);
    });

    ipcMain.on('dismiss-notification', (event, { id }) => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) notificationPlugin.dismissNotification(activeDev, id);
    });

    ipcMain.on('send-clipboard', (event, { content }) => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) clipboardPlugin.sendClipboard(activeDev, content);
    });

    ipcMain.on('media-control', (event, { action, volume }) => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) {
            if (action === 'setVolume') mprisPlugin.setVolume(activeDev, volume);
            else mprisPlugin.sendAction(activeDev, action);
        }
    });

    ipcMain.on('ring-phone', () => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) findMyPhonePlugin.ringPhone(activeDev);
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

        // Request initial data sync
        notificationPlugin.requestAllNotifications(deviceConnection);
        batteryPlugin.requestBatteryStatus(deviceConnection);
        connectivityPlugin.requestReport(deviceConnection);
        smsPlugin.requestAllThreads(deviceConnection);
        contactsPlugin.requestAllContacts(deviceConnection);
        sftpPlugin.requestSftpMount(deviceConnection);
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
