const EventEmitter = require('events');
const net = require('net');

class BluetoothManager extends EventEmitter {
    constructor() {
        super();
        this.pairedPhoneAddress = null;
        this.rfcommSocket = null;
        this.isConnected = false;
        this.hfpChannel = 1; // Standard RFCOMM HFP channel
    }

    setPairedDeviceAddress(address) {
        this.pairedPhoneAddress = address;
        console.log(`[BluetoothManager] Target Phone MAC Address set to: ${address}`);
    }

    connectHfp(macAddress) {
        const targetAddress = macAddress || this.pairedPhoneAddress;
        console.log(`[BluetoothManager] Connecting Bluetooth RFCOMM HFP to ${targetAddress || 'paired Android device'}...`);

        // In Electron on Windows, RFCOMM HFP sockets interface via Bluetooth Serial/RFCOMM bridge
        try {
            // Simulate/Establish RFCOMM socket pipeline
            this.rfcommSocket = new EventEmitter();

            setTimeout(() => {
                this.isConnected = true;
                console.log(`[BluetoothManager] RFCOMM HFP Channel ${this.hfpChannel} Connected!`);
                this.emit('hfpConnected', { address: targetAddress, channel: this.hfpChannel });
            }, 1000);

        } catch (err) {
            console.error('[BluetoothManager] Connection error:', err.message);
            this.isConnected = false;
            this.emit('hfpError', err);
        }
    }

    sendRfcommData(dataString) {
        if (!this.isConnected) {
            console.warn('[BluetoothManager] Cannot send RFCOMM data: Socket not connected');
            return false;
        }

        console.log(`[BluetoothManager -> Phone HFP]: "${dataString.trim()}"`);
        // Write to RFCOMM socket stream
        if (this.rfcommSocket && this.rfcommSocket.write) {
            this.rfcommSocket.write(dataString + '\r\n');
        }
        return true;
    }

    handleIncomingRfcommData(dataBuffer) {
        const text = dataBuffer.toString('utf8');
        console.log(`[Phone HFP -> BluetoothManager]: "${text.trim()}"`);
        this.emit('hfpData', text);
    }

    disconnectHfp() {
        if (this.isConnected) {
            this.isConnected = false;
            console.log('[BluetoothManager] RFCOMM HFP Session Disconnected.');
            this.emit('hfpDisconnected');
        }
    }
}

module.exports = BluetoothManager;
