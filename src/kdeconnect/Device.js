const tls = require('tls');
const EventEmitter = require('events');

class Device extends EventEmitter {
    constructor(deviceInfo, cryptoHelper) {
        super();
        this.info = deviceInfo; // { id, name, ip, port, ... }
        this.crypto = cryptoHelper;
        this.socket = null;
        this.connected = false;
        this.buffer = '';
    }

    connect() {
        console.log(`[Device] Connecting TLS to ${this.info.name} at ${this.info.ip}:${this.info.port}...`);

        const options = {
            host: this.info.ip,
            port: this.info.port || 1716,
            key: this.crypto.privateKey,
            cert: this.crypto.certificate,
            rejectUnauthorized: false // Self-signed KDE Connect certificates
        };

        try {
            this.socket = tls.connect(options, () => {
                this.connected = true;
                console.log(`[Device] Encrypted TLS Connection Established with ${this.info.name}`);
                this.emit('connected', this.info);

                // Send identity packet immediately after connecting
                this.sendPacket(this.crypto.getIdentityPacket());
            });

            this.socket.setEncoding('utf8');

            this.socket.on('data', (data) => {
                this.handleRawData(data);
            });

            this.socket.on('end', () => {
                this.handleDisconnect('Socket ended by remote device');
            });

            this.socket.on('error', (err) => {
                console.error(`[Device Error] ${this.info.name}:`, err.message);
                this.handleDisconnect(err.message);
            });

            this.socket.on('close', () => {
                this.handleDisconnect('Socket closed');
            });

        } catch (err) {
            console.error(`[Device Connection Failure] ${this.info.name}:`, err.message);
            this.handleDisconnect(err.message);
        }
    }

    handleRawData(data) {
        this.buffer += data;

        // KDE Connect protocol uses newline-delimited JSON packets
        let newlineIndex = this.buffer.indexOf('\n');
        while (newlineIndex !== -1) {
            const jsonLine = this.buffer.substring(0, newlineIndex).trim();
            this.buffer = this.buffer.substring(newlineIndex + 1);

            if (jsonLine.length > 0) {
                try {
                    const packet = JSON.parse(jsonLine);
                    this.emit('packet', packet);
                } catch (err) {
                    console.warn('[Device] Failed to parse JSON packet:', err.message);
                }
            }

            newlineIndex = this.buffer.indexOf('\n');
        }
    }

    sendPacket(packet) {
        if (!this.socket || !this.connected) {
            console.warn(`[Device] Cannot send packet to ${this.info.name}: Socket not connected`);
            return false;
        }

        try {
            const payload = JSON.stringify(packet) + '\n';
            this.socket.write(payload, 'utf8');
            return true;
        } catch (err) {
            console.error(`[Device] Send Packet Error to ${this.info.name}:`, err.message);
            return false;
        }
    }

    handleDisconnect(reason) {
        if (this.connected) {
            this.connected = false;
            console.log(`[Device] Disconnected from ${this.info.name}. Reason: ${reason}`);
            this.emit('disconnected', { info: this.info, reason });
        }
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
    }

    disconnect() {
        this.handleDisconnect('User initiated disconnect');
    }
}

module.exports = Device;
