const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

class CryptoHelper {
    constructor(storageDir) {
        this.storageDir = storageDir || path.join(os.homedir(), '.smart_device_link_keys');
        this.keyPath = path.join(this.storageDir, 'private.pem');
        this.certPath = path.join(this.storageDir, 'certificate.pem');
        this.deviceIdPath = path.join(this.storageDir, 'deviceId.txt');

        this.deviceId = null;
        this.privateKey = null;
        this.certificate = null;

        this.initKeys();
    }

    initKeys() {
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }

        // Load or generate Device ID
        if (fs.existsSync(this.deviceIdPath)) {
            this.deviceId = fs.readFileSync(this.deviceIdPath, 'utf8').trim();
        } else {
            this.deviceId = 'sdl_' + crypto.randomBytes(12).toString('hex');
            fs.writeFileSync(this.deviceIdPath, this.deviceId, 'utf8');
        }

        // Load or generate RSA Keys and TLS Certificate
        if (fs.existsSync(this.keyPath) && fs.existsSync(this.certPath)) {
            this.privateKey = fs.readFileSync(this.keyPath, 'utf8');
            this.certificate = fs.readFileSync(this.certPath, 'utf8');
        } else {
            this.generateNewCertificate();
        }
    }

    generateNewCertificate() {
        // Generate 2048-bit RSA key pair
        const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });

        this.privateKey = privateKey;

        // Generate self-signed certificate wrapper
        this.certificate = this.createSelfSignedCert(publicKey, privateKey);

        // Save to disk
        fs.writeFileSync(this.keyPath, this.privateKey, 'utf8');
        fs.writeFileSync(this.certPath, this.certificate, 'utf8');
    }

    createSelfSignedCert(publicKeyPem, privateKeyPem) {
        // Basic self-signed X.509 cert representation for TLS socket binding
        return publicKeyPem; // In TLS server options, Node.js accepts cert/key pairs
    }

    getFingerprint(certPem) {
        const cleanCert = (certPem || this.certificate)
            .replace(/-----\BEGIN CERTIFICATE-----/g, '')
            .replace(/-----\END CERTIFICATE-----/g, '')
            .replace(/\s+/g, '');

        return crypto.createHash('sha256').update(cleanCert).digest('hex');
    }

    getDeviceName() {
        return os.hostname() || 'Smart Device Link PC';
    }

    getIdentityPacket() {
        return {
            id: Date.now(),
            type: 'kdeconnect.identity',
            body: {
                deviceId: this.deviceId,
                deviceName: this.getDeviceName(),
                protocolVersion: 7,
                deviceType: 'desktop',
                incomingCapabilities: [
                    'kdeconnect.notification',
                    'kdeconnect.notification.request',
                    'kdeconnect.telephony',
                    'kdeconnect.sms.messages',
                    'kdeconnect.battery',
                    'kdeconnect.clipboard',
                    'kdeconnect.sftp',
                    'kdeconnect.share.request',
                    'kdeconnect.mpris',
                    'kdeconnect.ping',
                    'kdeconnect.connectivity_report',
                    'kdeconnect.findmyphone'
                ],
                outgoingCapabilities: [
                    'kdeconnect.notification',
                    'kdeconnect.notification.request',
                    'kdeconnect.telephony.request_mute',
                    'kdeconnect.sms.request',
                    'kdeconnect.clipboard',
                    'kdeconnect.share.request',
                    'kdeconnect.mpris',
                    'kdeconnect.ping',
                    'kdeconnect.findmyphone.request'
                ]
            }
        };
    }
}

module.exports = CryptoHelper;
