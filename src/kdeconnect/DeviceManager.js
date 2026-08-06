const dgram = require('dgram');
const EventEmitter = require('events');
const os = require('os');

class DeviceManager extends EventEmitter {
    constructor(cryptoHelper) {
        super();
        this.crypto = cryptoHelper;
        this.port = 1716;
        this.udpSocket = null;
        this.discoveredDevices = new Map();
        this.broadcastInterval = null;
    }

    startDiscovery() {
        this.udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        this.udpSocket.on('error', (err) => {
            console.error('[UDP DeviceManager] Socket Error:', err.message);
        });

        this.udpSocket.on('message', (msg, rinfo) => {
            this.handleIncomingBroadcast(msg, rinfo);
        });

        this.udpSocket.on('listening', () => {
            const address = this.udpSocket.address();
            console.log(`[UDP DeviceManager] Listening for KDE Connect devices on UDP ${address.address}:${address.port}`);
            try {
                this.udpSocket.setBroadcast(true);
            } catch (e) {
                console.warn('[UDP DeviceManager] Broadcast set warning:', e.message);
            }

            // Start broadcasting identity packet every 5 seconds
            this.sendIdentityBroadcast();
            this.broadcastInterval = setInterval(() => this.sendIdentityBroadcast(), 5000);
        });

        try {
            this.udpSocket.bind(this.port);
        } catch (e) {
            console.error('[UDP DeviceManager] Bind failed:', e.message);
        }
    }

    handleIncomingBroadcast(msgBuffer, rinfo) {
        try {
            const rawText = msgBuffer.toString('utf8').trim();
            const packet = JSON.parse(rawText);

            if (packet.type === 'kdeconnect.identity' && packet.body) {
                const remoteDeviceId = packet.body.deviceId;

                // Ignore our own broadcast
                if (remoteDeviceId === this.crypto.deviceId) return;

                const deviceData = {
                    id: remoteDeviceId,
                    name: packet.body.deviceName || 'Android Device',
                    type: packet.body.deviceType || 'phone',
                    ip: rinfo.address,
                    port: packet.body.tcpPort || 1716,
                    protocolVersion: packet.body.protocolVersion || 7,
                    incomingCapabilities: packet.body.incomingCapabilities || [],
                    outgoingCapabilities: packet.body.outgoingCapabilities || [],
                    lastSeen: Date.now()
                };

                const isNew = !this.discoveredDevices.has(remoteDeviceId);
                this.discoveredDevices.set(remoteDeviceId, deviceData);

                if (isNew) {
                    console.log(`[UDP DeviceManager] Discovered Device: ${deviceData.name} (${deviceData.ip})`);
                    this.emit('deviceDiscovered', deviceData);
                } else {
                    this.emit('deviceUpdated', deviceData);
                }
            }
        } catch (err) {
            // Ignore invalid or non-JSON UDP packets
        }
    }

    sendIdentityBroadcast() {
        if (!this.udpSocket) return;

        const identityPacket = this.crypto.getIdentityPacket();
        // Include TCP port for incoming TLS connections
        identityPacket.body.tcpPort = 1716;

        const jsonStr = JSON.stringify(identityPacket) + '\n';
        const message = Buffer.from(jsonStr, 'utf8');

        // Broadcast to 255.255.255.255 and local subnet broadcast IPs
        const broadcastAddresses = this.getBroadcastAddresses();
        broadcastAddresses.forEach((ip) => {
            this.udpSocket.send(message, 0, message.length, this.port, ip, (err) => {
                if (err && err.code !== 'ENETUNREACH') {
                    // Ignore transient network errors
                }
            });
        });
    }

    getBroadcastAddresses() {
        const addresses = new Set(['255.255.255.255']);
        const interfaces = os.networkInterfaces();

        for (const name of Object.keys(interfaces)) {
            for (const net of interfaces[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    // Simple subnet broadcast fallback
                    const parts = net.address.split('.');
                    if (parts.length === 4) {
                        addresses.add(`${parts[0]}.${parts[1]}.${parts[2]}.255`);
                    }
                }
            }
        }
        return Array.from(addresses);
    }

    stopDiscovery() {
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
            this.broadcastInterval = null;
        }
        if (this.udpSocket) {
            this.udpSocket.close();
            this.udpSocket = null;
        }
    }

    getDiscoveredDevices() {
        return Array.from(this.discoveredDevices.values());
    }
}

module.exports = DeviceManager;
