const { ipcMain, app } = require('electron');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
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

// Phase 6 Bluetooth HFP Engine & Audio Bridge
const BluetoothManager = require('../bluetooth/BluetoothManager');
const HfpProtocol = require('../bluetooth/HfpProtocol');
const AudioBridge = require('../audio/AudioBridge');

let cryptoHelper = null;
let deviceManager = null;
let packetRouter = null;
let pairingManager = null;
let activeDeviceConnections = new Map(); // deviceId -> Device instance
let currentMainWindow = null;

// Phase 6 Engine Instances
let btManager = null;
let hfpProtocol = null;
let audioBridge = null;

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

function setMainWindow(win) {
    currentMainWindow = win;
}

function initKDEConnectBridge(mainWindow) {
    currentMainWindow = mainWindow;
    console.log('[KDEConnect Bridge] Initializing Protocol Engine & All Feature Plugins...');

    const pluginEvents = new EventEmitter();

    cryptoHelper = new CryptoHelper();
    deviceManager = new DeviceManager(cryptoHelper);
    packetRouter = new PacketRouter();
    pairingManager = new PairingManager(packetRouter, cryptoHelper);

    // Phase 6 Bluetooth & Audio Setup
    btManager = new BluetoothManager();
    hfpProtocol = new HfpProtocol(btManager);
    audioBridge = new AudioBridge();

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
    const outboundRetryWindow = new Map(); // deviceId -> last outbound attempt (ms)

    const autoConnectPairedDevice = (deviceInfo) => {
        if (!deviceInfo || !deviceInfo.id) return;
        if (pairingManager.isPaired(deviceInfo.id) !== true) return;
        if (activeDeviceConnections.has(deviceInfo.id)) return;

        // Nudge the phone to open a connection to us: the phone's udpPacketReceived
        // reacts to ANY identity packet (broadcast or unicast). A unicast to its IP
        // is more reliable than a subnet broadcast, which some routers drop.
        if (deviceManager.sendIdentityToIp) {
            deviceManager.sendIdentityToIp(deviceInfo.ip);
        }

        // The phone normally connects to us on its own whenever it receives our
        // UDP broadcast. Give it a moment to do that before we try the outbound
        // fallback, and never retry outbound more often than every 10s.
        const lastAttempt = outboundRetryWindow.get(deviceInfo.id) || 0;
        if (Date.now() - lastAttempt < 10000) return;
        outboundRetryWindow.set(deviceInfo.id, Date.now());

        setTimeout(() => {
            if (activeDeviceConnections.has(deviceInfo.id)) return;
            const latest = deviceManager.discoveredDevices.get(deviceInfo.id);
            if (!latest) return;
            console.log(`[Bridge] Connecting to paired device ${latest.name}...`);
            connectToDevice(latest, currentMainWindow);
        }, 3000);
    };

    deviceManager.on('deviceDiscovered', (deviceInfo) => {
        if (currentMainWindow && !currentMainWindow.isDestroyed()) {
            currentMainWindow.webContents.send('discovered-devices-changed', deviceManager.getDiscoveredDevices());
        }
        autoConnectPairedDevice(deviceInfo);
    });

    // Self-heal reconnects: after a disconnect (e.g. Wi-Fi drop), the phone keeps
    // broadcasting its identity over UDP. Whenever we hear from a paired device
    // that isn't connected, actively re-establish the link instead of waiting
    // passively for the phone to connect to us.
    deviceManager.on('deviceUpdated', (deviceInfo) => {
        autoConnectPairedDevice(deviceInfo);
    });


    // Handle incoming connections initiated from phone
    deviceManager.on('incomingConnection', ({ tlsSocket, identityPacket }) => {
        const deviceId = identityPacket?.body?.deviceId;
        const deviceName = identityPacket?.body?.deviceName || 'Android Device';

        if (!deviceId) {
            console.warn('[Bridge] Incoming TLS connection missing deviceId');
            return;
        }

        console.log(`[Bridge] Incoming TLS Connection accepted from ${tlsSocket.remoteAddress} (${deviceName})`);

        let tempDev = activeDeviceConnections.get(deviceId);
        const isReused = !!tempDev;

        if (tempDev) {
            console.log(`[Bridge] Reusing connection for ${deviceName} (${deviceId})`);
            const oldSocket = tempDev.socket;
            tempDev.socket = null;
            tempDev.buffer = '';

            if (oldSocket) {
                oldSocket.removeAllListeners();
                oldSocket.on('error', () => { });
                const teardownTimer = setTimeout(() => oldSocket.destroy(), 1000);
                oldSocket.once('close', () => clearTimeout(teardownTimer));
                try {
                    oldSocket.end();
                } catch (e) {
                    oldSocket.destroy();
                }
            }
            tempDev.info.ip = tlsSocket.remoteAddress;
            tempDev.info.name = deviceName;
        } else {
            tempDev = new Device({
                id: deviceId,
                ip: tlsSocket.remoteAddress,
                port: identityPacket?.body?.tcpPort || 1716,
                name: deviceName,
                type: identityPacket?.body?.deviceType || 'phone',
                protocolVersion: identityPacket?.body?.protocolVersion || 7,
                incomingCapabilities: identityPacket?.body?.incomingCapabilities || [],
                outgoingCapabilities: identityPacket?.body?.outgoingCapabilities || []
            }, cryptoHelper);

            tempDev.on('packet', (packet) => {
                if (packet.type === 'kdeconnect.identity') {
                    tempDev.info.id = packet.body.deviceId;
                    tempDev.info.name = packet.body.deviceName || 'Android Device';
                    console.log(`[Bridge] Authenticated connection from ${tempDev.info.name} (${tempDev.info.id})`);
                } else {
                    packetRouter.routePacket(tempDev, packet);
                }
            });

            activeDeviceConnections.set(deviceId, tempDev);
        }

        if (!tempDev.hasDisconnectListener) {
            tempDev.hasDisconnectListener = true;
            tempDev.on('disconnected', () => {
                console.log(`[Bridge] Device ${tempDev.info.name} disconnected.`);
                activeDeviceConnections.delete(deviceId);
                if (currentMainWindow && !currentMainWindow.isDestroyed()) {
                    currentMainWindow.webContents.send('device-status-changed', {
                        connected: false,
                        wifi: false,
                        bluetooth: false,
                        signal: 0,
                        networkType: 'Offline'
                    });
                }
            });
        }

        tempDev.socket = tlsSocket;
        tempDev.connected = true;
        tempDev.lastPacketAt = Date.now();
        tempDev.isPaired = pairingManager.isPaired(deviceId);
        tempDev.cancelPendingDisconnect();
        tempDev.startHeartbeat();

        tlsSocket.setKeepAlive(true, 3000);
        tlsSocket.setEncoding('utf8');
        tlsSocket.on('data', (data) => tempDev.handleRawData(data));
        tlsSocket.on('close', () => tempDev.handleDisconnect('Socket closed'));
        tlsSocket.on('error', (err) => tempDev.handleDisconnect(err.message));

        if (currentMainWindow && !currentMainWindow.isDestroyed()) {
            currentMainWindow.webContents.send('device-status-changed', {
                name: tempDev.info.name,
                connected: true,
                wifi: true,
                isPaired: pairingManager.isPaired(deviceId)
            });
        }

        // Request battery, connectivity, notifications, SMS threads, and contacts on initial connection
        if (batteryPlugin) batteryPlugin.requestBatteryStatus(tempDev);
        if (connectivityPlugin) connectivityPlugin.requestReport(tempDev);
        if (!isReused) {
            if (notificationPlugin) notificationPlugin.requestAllNotifications(tempDev);
            if (smsPlugin) smsPlugin.requestAllThreads(tempDev);
            if (contactsPlugin) contactsPlugin.requestAllContacts(tempDev);
        }
    });


    const enrichDiscoveredDevices = (devicesList) => {
        if (!devicesList) return [];
        return devicesList.map((dev) => ({
            ...dev,
            isPaired: pairingManager ? pairingManager.isPaired(dev.id) : false,
            isConnected: activeDeviceConnections ? activeDeviceConnections.has(dev.id) : false
        }));
    };

    // Forward Discovered Devices to UI with paired/connected flags
    deviceManager.on('deviceDiscovered', () => {
        if (currentMainWindow && !currentMainWindow.isDestroyed()) {
            currentMainWindow.webContents.send('discovered-devices-changed', enrichDiscoveredDevices(deviceManager.getDiscoveredDevices()));
        }
    });

    ipcMain.handle('get-discovered-devices', () => {
        if (deviceManager) {
            deviceManager.sendIdentityBroadcast();
            return enrichDiscoveredDevices(deviceManager.getDiscoveredDevices());
        }
        return [];
    });


    // Pairing Manager Events
    pairingManager.on('pairingRequested', (data) => {
        if (currentMainWindow && !currentMainWindow.isDestroyed()) {
            currentMainWindow.webContents.send('pairing-requested', data);
        }
    });

    // Keep each connection's heartbeat pairing-aware: the phone only answers
    // plugin pings (battery.request) once paired, so isPaired gates the timeout.
    pairingManager.on('devicePaired', (data) => {
        const dev = activeDeviceConnections.get(data.id);
        if (dev) dev.isPaired = true;
        if (currentMainWindow && !currentMainWindow.isDestroyed()) {
            currentMainWindow.webContents.send('discovered-devices-changed', enrichDiscoveredDevices(deviceManager.getDiscoveredDevices()));
            currentMainWindow.webContents.send('device-status-changed', { isPaired: true });
        }
    });

    pairingManager.on('deviceUnpaired', (data) => {
        const dev = activeDeviceConnections.get(data.id);
        if (dev) dev.isPaired = false;
        if (currentMainWindow && !currentMainWindow.isDestroyed()) {
            currentMainWindow.webContents.send('discovered-devices-changed', enrichDiscoveredDevices(deviceManager.getDiscoveredDevices()));
            currentMainWindow.webContents.send('device-status-changed', { isPaired: false });
        }
    });


    // Forward Notification Events
    pluginEvents.on('notificationReceived', (data) => {
        if (currentMainWindow && !currentMainWindow.isDestroyed()) {
            currentMainWindow.webContents.send('notification-received', data);
        }
    });

    pluginEvents.on('notificationDismissed', (data) => {
        if (currentMainWindow && !currentMainWindow.isDestroyed()) {
            currentMainWindow.webContents.send('notification-dismissed', data);
        }
    });

    ipcMain.handle('get-notifications', () => {
        return notificationPlugin ? notificationPlugin.getNotifications() : [];
    });

    ipcMain.on('clear-all-notifications', () => {
        if (notificationPlugin) {
            const activeDev = getFirstActiveDevice();
            notificationPlugin.clearAllNotifications(activeDev);
        }
    });


    pluginEvents.on('batteryStateChanged', (data) => {
        if (currentMainWindow && !currentMainWindow.isDestroyed()) currentMainWindow.webContents.send('device-status-changed', { battery: data.charge, isCharging: data.isCharging });
    });

    pluginEvents.on('connectivityStateChanged', (data) => {
        if (currentMainWindow && !currentMainWindow.isDestroyed()) {
            currentMainWindow.webContents.send('device-status-changed', {
                signal: data.signalStrength,
                networkType: data.networkType || 'NA'
            });
        }
    });


    pluginEvents.on('clipboardReceived', (data) => {
        if (currentMainWindow && !currentMainWindow.isDestroyed()) currentMainWindow.webContents.send('clipboard-received', data);
    });

    pluginEvents.on('mediaStateChanged', (data) => {
        if (currentMainWindow && !currentMainWindow.isDestroyed()) currentMainWindow.webContents.send('media-state-changed', data);
    });

    pluginEvents.on('incomingCall', (data) => {
        if (currentMainWindow && !currentMainWindow.isDestroyed()) currentMainWindow.webContents.send('incoming-call', data);
    });

    pluginEvents.on('smsThreadsUpdated', (data) => {
        if (currentMainWindow && !currentMainWindow.isDestroyed()) currentMainWindow.webContents.send('sms-threads-updated', data);
    });

    pluginEvents.on('contactsUpdated', (data) => {
        if (currentMainWindow && !currentMainWindow.isDestroyed()) {
            currentMainWindow.webContents.send('contacts-updated', data);
        }
    });

    pluginEvents.on('smsNotificationReceived', (data) => {
        const activeDev = getFirstActiveDevice();
        if (smsPlugin && activeDev) {
            smsPlugin.handlePacket(activeDev, {
                type: 'kdeconnect.notification',
                body: {
                    appName: data.appName,
                    packageName: data.packageName,
                    title: data.title,
                    text: data.text,
                    id: data.id
                }
            });
        }
    });

    ipcMain.on('fetch-sms-thread-messages', (event, { threadId }) => {
        const activeDev = getFirstActiveDevice();
        if (activeDev && smsPlugin) smsPlugin.requestThreadMessages(activeDev, threadId);
    });


    // HFP Bluetooth Events
    hfpProtocol.on('incomingCallRinging', () => {
        if (currentMainWindow && !currentMainWindow.isDestroyed()) {
            currentMainWindow.webContents.send('incoming-call', { status: 'RINGING' });
        }
    });

    hfpProtocol.on('callAnswered', () => {
        audioBridge.startAudioRouting();
    });

    hfpProtocol.on('callEnded', () => {
        audioBridge.stopAudioRouting();
    });

    // IPC Handlers for Call Audio Actions
    ipcMain.on('answer-call-audio', () => {
        hfpProtocol.answerCall();
        audioBridge.startAudioRouting();
    });

    ipcMain.on('hangup-call-audio', () => {
        hfpProtocol.hangupCall();
        audioBridge.stopAudioRouting();
    });

    ipcMain.on('toggle-mute-audio', (event, { muted }) => {
        audioBridge.setMicrophoneMuted(muted);
        hfpProtocol.setMicrophoneVolume(muted ? 0 : 12);
    });

    ipcMain.on('transfer-call-audio', (event, { target }) => {
        if (target === 'PHONE_EARPIECE') {
            audioBridge.transferCallAudioToPhone();
        } else {
            audioBridge.transferCallAudioToPc();
        }
    });

    ipcMain.on('dial-number', (event, { number }) => {
        console.log(`[Bridge] Dialing via Bluetooth HFP: ${number}`);
        hfpProtocol.dialNumber(number);
        audioBridge.startAudioRouting();
    });

    // Storage & Files Handlers
    ipcMain.handle('fetch-files', async (event, { path }) => {
        try {
            return await sftpPlugin.listDirectory(path || '/sdcard');
        } catch (e) {
            return [];
        }
    });

    // Discovers the phone's available storage roots (internal storage and any SD cards)
    // by probing Android mount points through SFTP.
    ipcMain.handle('list-storage-roots', async () => {
        const activeDev = getFirstActiveDevice();
        if (!activeDev || !sftpPlugin) return [];

        const roots = [];
        const seen = new Set();

        const tryAdd = (id, name, path) => {
            if (!path || seen.has(path)) return;
            seen.add(path);
            roots.push({ id, name, path });
        };

        const readable = async (p) => {
            try {
                await sftpPlugin.listDirectory(p);
                return true;
            } catch (e) {
                return false;
            }
        };

        // Directories under /storage that are internal-storage mounts (NOT SD cards).
        const INTERNAL_DIR = /^(emulated|self|primary|sdcard|sdcard0)$/i;

        const isInternalPath = (p) => {
            if (p === internalPath) return true;
            return /^\/(sdcard|mnt\/sdcard|storage\/emulated\/0|storage\/self\/primary)$/.test(p);
        };

        // Resolve the internal storage root once, so only one "Internal Storage" entry is shown.
        let internalPath = null;
        for (const candidate of ['/sdcard', '/storage/emulated/0', '/storage/self/primary', '/mnt/sdcard']) {
            if (await readable(candidate)) {
                internalPath = candidate;
                break;
            }
        }
        if (internalPath) tryAdd('internal', 'Internal Storage', internalPath);

        const classifySD = async (p) => {
            if (!p || seen.has(p) || isInternalPath(p)) return;
            if (await readable(p)) {
                tryAdd(`sd_${p.replace(/[^a-zA-Z0-9]+/g, '_')}`, 'SD Card', p);
            }
        };

        // Scan /storage for removable SD cards (everything there that isn't internal storage).
        try {
            const entries = await sftpPlugin.listDirectory('/storage');
            for (const entry of entries) {
                if (!entry.isDir) continue;
                if (INTERNAL_DIR.test(entry.name)) continue;
                await classifySD(`/storage/${entry.name}`);
            }
        } catch (e) {
            // SFTP root may be chrooted to a single folder, so /storage is not listable;
            // fall through to the other mount locations below.
        }

        // Physical SD card mounts live under /mnt/media_rw (UUID-style dirs).
        try {
            const entries = await sftpPlugin.listDirectory('/mnt/media_rw');
            for (const entry of entries) {
                if (!entry.isDir) continue;
                await classifySD(`/mnt/media_rw/${entry.name}`);
            }
        } catch (e) {
            // not listable
        }

        // Common well-known removable storage paths.
        for (const p of [
            '/storage/sdcard1',
            '/storage/extSdCard',
            '/storage/external_sd',
            '/storage/ext_sd',
            '/mnt/sdcard1',
            '/mnt/extSdCard',
            '/mnt/external_sd',
            '/mnt/ext_sd',
            '/mnt/expand'
        ]) {
            await classifySD(p);
        }

        // The SFTP plugin's configured root always works, so surface it if it isn't internal.
        if (sftpPlugin.sftpConfig && sftpPlugin.sftpConfig.path) {
            const cfgPath = sftpPlugin.sftpConfig.path;
            if (cfgPath && cfgPath !== internalPath && !isInternalPath(cfgPath)) {
                await classifySD(cfgPath);
            }
        }

        console.log(`[Bridge] Storage roots (internal=${internalPath || 'none'}):`, roots.map((r) => `${r.name}@${r.path}`).join(', ') || 'none');
        return roots;
    });

    ipcMain.on('upload-file', async (event, { localPath, remoteDirectory }) => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) {
            const fileName = require('path').basename(localPath);
            await sftpPlugin.uploadFile(localPath, `${remoteDirectory}/${fileName}`);
        }
    });

    ipcMain.on('delete-file', async (event, { remotePath, isDir }) => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) await sftpPlugin.deleteItem(remotePath, isDir);
    });

    ipcMain.handle('create-directory', async (event, { path: remotePath }) => {
        if (!remotePath) return { ok: false, error: 'No path provided' };
        try {
            await sftpPlugin.createDirectory(remotePath);
            return { ok: true };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    });


    // Photos & SFTP Handlers
    const photoCacheDir = path.join(app.getPath('temp'), 'smart_device_link_photos');
    if (!fs.existsSync(photoCacheDir)) fs.mkdirSync(photoCacheDir, { recursive: true });

    async function scanAndCachePhotos() {
        const activeDev = getFirstActiveDevice();
        if (!activeDev || !sftpPlugin) return [];

        try {
            if (!sftpPlugin.sftpConfig) {
                sftpPlugin.requestSftpMount(activeDev);
                await new Promise((r) => setTimeout(r, 1200));
            }
            const rawFiles = await sftpPlugin.listDirectory('/sdcard/DCIM/Camera');
            const imageFiles = rawFiles.filter((f) => !f.isDir && /\.(jpg|jpeg|png|webp|heic)$/i.test(f.name)).slice(0, 30);

            const photoList = [];
            for (const file of imageFiles) {
                const localPath = path.join(photoCacheDir, file.name);
                if (!fs.existsSync(localPath)) {
                    try {
                        await sftpPlugin.downloadFile(file.path, localPath);
                    } catch (e) {
                        console.warn(`[Bridge] Failed to download thumbnail for ${file.name}:`, e.message);
                    }
                }

                photoList.push({
                    id: file.name,
                    name: file.name,
                    path: file.path,
                    url: `file:///${localPath.replace(/\\/g, '/')}`,
                    date: file.modifyTime || Date.now(),
                    size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                });
            }
            return photoList;
        } catch (err) {
            console.warn('[Bridge] Photos scan failed:', err.message);
            return [];
        }
    }

    ipcMain.handle('get-photos', async () => {
        return await scanAndCachePhotos();
    });

    ipcMain.on('scan-photos', async () => {
        const photos = await scanAndCachePhotos();
        if (currentMainWindow && !currentMainWindow.isDestroyed()) {
            currentMainWindow.webContents.send('photos-updated', photos);
        }
    });

    ipcMain.on('download-file', async (event, { remotePath, name }) => {
        const activeDev = getFirstActiveDevice();
        if (!activeDev || !sftpPlugin) return;
        try {
            const downloadsFolder = app.getPath('downloads');
            const destPath = path.join(downloadsFolder, name || path.basename(remotePath));
            await sftpPlugin.downloadFile(remotePath, destPath);
            console.log(`[Bridge] Downloaded ${name} to ${destPath}`);
        } catch (e) {
            console.error('[Bridge] Download failed:', e.message);
        }
    });
    // Messaging Handlers
    ipcMain.handle('get-sms-threads', () => {
        return smsPlugin ? smsPlugin.getThreadsList() : [];
    });

    ipcMain.on('fetch-sms-threads', () => {
        const activeDev = getFirstActiveDevice();
        if (activeDev && smsPlugin) smsPlugin.requestAllThreads(activeDev);
    });

    ipcMain.on('send-sms', (event, { phoneNumber, messageText }) => {
        const activeDev = getFirstActiveDevice();
        if (activeDev && smsPlugin) smsPlugin.sendSms(activeDev, phoneNumber, messageText);
    });

    // Contacts Handlers
    ipcMain.handle('get-contacts', () => {
        return contactsPlugin ? contactsPlugin.getContactsList() : [];
    });

    ipcMain.on('fetch-contacts', () => {
        const activeDev = getFirstActiveDevice();
        if (activeDev && contactsPlugin) contactsPlugin.requestAllContacts(activeDev);
    });

    ipcMain.on('share-url', (event, { url }) => {
        const activeDev = getFirstActiveDevice();
        if (activeDev) sharePlugin.shareUrlToPhone(activeDev, url);
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

    ipcMain.handle('pair-device', (event, deviceId) => {
        const devInfo = deviceManager.discoveredDevices.get(deviceId);
        if (!devInfo) return { success: false, message: 'Device not found' };

        let devConn = activeDeviceConnections.get(deviceId);
        if (!devConn) {
            devConn = connectToDevice(devInfo, currentMainWindow);
        }

        if (devConn.connected) {
            pairingManager.requestPair(devConn);
        } else {
            devConn.once('connected', () => {
                pairingManager.requestPair(devConn);
            });
        }
        return { success: true };
    });


    ipcMain.handle('accept-pair', (event, deviceId) => {
        const devConn = activeDeviceConnections.get(deviceId);
        if (devConn) {
            pairingManager.acceptPair(devConn);
            return { success: true };
        }
        return { success: false, message: 'Device connection not active' };
    });

    ipcMain.handle('unpair-device', (event, deviceId) => {
        pairingManager.unpair(deviceId);
        const devConn = activeDeviceConnections.get(deviceId);
        if (devConn) {
            pairingManager.rejectPair(devConn);
            devConn.disconnect();
        }
        return { success: true };
    });

    return { cryptoHelper, deviceManager, packetRouter, pairingManager, btManager, hfpProtocol, audioBridge };
}

function getFirstActiveDevice() {
    const values = Array.from(activeDeviceConnections.values());
    return values.length > 0 ? values[0] : null;
}

function connectToDevice(deviceInfo, mainWindow) {
    if (activeDeviceConnections.has(deviceInfo.id)) {
        return activeDeviceConnections.get(deviceInfo.id);
    }

    const deviceConnection = new Device(deviceInfo, cryptoHelper);
    deviceConnection.isPaired = pairingManager.isPaired(deviceInfo.id);
    activeDeviceConnections.set(deviceInfo.id, deviceConnection);

    deviceConnection.on('connected', (info) => {
        activeDeviceConnections.set(info.id, deviceConnection);
        const win = currentMainWindow || mainWindow;
        if (win && !win.isDestroyed()) {
            win.webContents.send('device-status-changed', {
                name: info.name,
                connected: true,
                battery: batteryPlugin ? batteryPlugin.batteryState.charge : 85,
                signal: connectivityPlugin ? connectivityPlugin.connectivityState.signalStrength : 4,
                wifi: true,
                bluetooth: true
            });
        }

        // Connect Bluetooth HFP channel alongside KDE Connect TCP link
        btManager.connectHfp(info.ip);

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

    deviceConnection.on('connectfailed', () => {
        // A failed connect attempt must not leave a dead placeholder in the map,
        // otherwise auto-connect sees it and never retries.
        activeDeviceConnections.delete(deviceInfo.id);
    });

    deviceConnection.on('disconnected', ({ info }) => {
        activeDeviceConnections.delete(info.id);
        btManager.disconnectHfp();
        const win = currentMainWindow || mainWindow;
        if (win && !win.isDestroyed()) {
            win.webContents.send('device-status-changed', { name: info.name, connected: false });
        }
    });

    deviceConnection.connect();
    return deviceConnection;
}

module.exports = { initKDEConnectBridge, setMainWindow };
