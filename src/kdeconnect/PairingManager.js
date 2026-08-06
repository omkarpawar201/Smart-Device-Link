const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');

class PairingManager extends EventEmitter {
    constructor(packetRouter, cryptoHelper) {
        super();
        this.router = packetRouter;
        this.crypto = cryptoHelper;
        this.pairedFilePath = path.join(os.homedir(), '.smart_device_link_keys', 'paired_devices.json');
        this.pairedDevices = new Map(); // deviceId -> { id, name, certFingerprint, pairedAt }

        this.loadPairedDevices();
        this.registerPairingHandler();
    }

    loadPairedDevices() {
        try {
            if (fs.existsSync(this.pairedFilePath)) {
                const raw = fs.readFileSync(this.pairedFilePath, 'utf8');
                const list = JSON.parse(raw);
                list.forEach((dev) => this.pairedDevices.set(dev.id, dev));
                console.log(`[PairingManager] Loaded ${this.pairedDevices.size} paired devices from disk.`);
            }
        } catch (err) {
            console.error('[PairingManager] Failed to load paired devices:', err.message);
        }
    }

    savePairedDevices() {
        try {
            const list = Array.from(this.pairedDevices.values());
            fs.writeFileSync(this.pairedFilePath, JSON.stringify(list, null, 2), 'utf8');
        } catch (err) {
            console.error('[PairingManager] Failed to save paired devices:', err.message);
        }
    }

    isPaired(deviceId) {
        return this.pairedDevices.has(deviceId);
    }

    registerPairingHandler() {
        this.router.on('packet:kdeconnect.pair', ({ device, packet }) => {
            const isPairRequest = packet.body && packet.body.pair === true;
            const isUnpairRequest = packet.body && packet.body.pair === false;

            console.log(`[PairingManager] Received pair packet from ${device.info.name} (pair: ${packet.body.pair})`);

            if (isPairRequest) {
                if (this.isPaired(device.info.id)) {
                    // Already paired, send confirmation pair packet back
                    this.acceptPair(device);
                } else {
                    // Emit incoming pair request prompt to UI
                    this.emit('pairingRequested', {
                        device: device.info,
                        requestId: packet.id
                    });
                }
            } else if (isUnpairRequest) {
                this.unpair(device.info.id);
                this.emit('deviceUnpaired', device.info);
            }
        });
    }

    requestPair(device) {
        console.log(`[PairingManager] Sending pair request to ${device.info.name}...`);
        const pairPacket = {
            id: Date.now(),
            type: 'kdeconnect.pair',
            body: { pair: true }
        };
        device.sendPacket(pairPacket);
    }

    acceptPair(device) {
        console.log(`[PairingManager] Accepting pair request from ${device.info.name}...`);

        // Save device as paired
        const pairedData = {
            id: device.info.id,
            name: device.info.name,
            ip: device.info.ip,
            pairedAt: new Date().toISOString()
        };

        this.pairedDevices.set(device.info.id, pairedData);
        this.savePairedDevices();

        // Send accept packet
        const acceptPacket = {
            id: Date.now(),
            type: 'kdeconnect.pair',
            body: { pair: true }
        };
        device.sendPacket(acceptPacket);

        this.emit('devicePaired', pairedData);
    }

    rejectPair(device) {
        console.log(`[PairingManager] Rejecting pair request from ${device.info.name}...`);
        const rejectPacket = {
            id: Date.now(),
            type: 'kdeconnect.pair',
            body: { pair: false }
        };
        device.sendPacket(rejectPacket);
    }

    unpair(deviceId) {
        if (this.pairedDevices.has(deviceId)) {
            this.pairedDevices.delete(deviceId);
            this.savePairedDevices();
            console.log(`[PairingManager] Device ${deviceId} unpaired.`);
            return true;
        }
        return false;
    }
}

module.exports = PairingManager;
