const BasePlugin = require('./BasePlugin');
const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');

class SftpPlugin extends BasePlugin {
    constructor(eventEmitter) {
        super('SftpPlugin');
        this.emitter = eventEmitter;
        this.sftpConfig = null;
        this.sftpClient = null;
        this.isConnected = false;
    }

    getCapabilities() {
        return ['kdeconnect.sftp'];
    }

    handlePacket(device, packet) {
        if (packet.type === 'kdeconnect.sftp') {
            const body = packet.body || {};

            this.sftpConfig = {
                ip: body.ip || device.info.ip,
                port: body.port || 1739,
                user: body.user || 'kdeconnect',
                password: body.password || '',
                path: body.path || '/sdcard'
            };

            console.log(`[SftpPlugin] Received SFTP Credentials for ${device.info.name} (${this.sftpConfig.ip}:${this.sftpConfig.port})`);

            if (this.emitter) {
                this.emitter.emit('sftpMounted', {
                    deviceId: device.info.id,
                    config: this.sftpConfig
                });
            }
        }
    }

    connectSftp(configOverride) {
        return new Promise((resolve, reject) => {
            const config = configOverride || this.sftpConfig;
            if (!config) return reject(new Error('No SFTP configuration available'));

            const conn = new Client();

            conn.on('ready', () => {
                console.log(`[SftpPlugin] SSH2 Client Ready. Opening SFTP session...`);
                conn.sftp((err, sftp) => {
                    if (err) {
                        conn.end();
                        return reject(err);
                    }
                    this.sftpClient = sftp;
                    this.isConnected = true;
                    resolve(sftp);
                });
            });

            conn.on('error', (err) => {
                console.error('[SftpPlugin] SSH2 Error:', err.message);
                this.isConnected = false;
                reject(err);
            });

            conn.connect({
                host: config.ip,
                port: config.port,
                username: config.user,
                password: config.password,
                readyTimeout: 10000
            });
        });
    }

    async listDirectory(remotePath = '/sdcard') {
        if (!this.sftpClient) await this.connectSftp();

        return new Promise((resolve, reject) => {
            this.sftpClient.readdir(remotePath, (err, list) => {
                if (err) return reject(err);

                const items = list.map((item) => ({
                    name: item.filename,
                    isDir: item.attrs.isDirectory(),
                    size: item.attrs.size,
                    modifyTime: item.attrs.mtime * 1000,
                    path: path.posix.join(remotePath, item.filename)
                }));

                items.sort((a, b) => {
                    if (a.isDir && !b.isDir) return -1;
                    if (!a.isDir && b.isDir) return 1;
                    return a.name.localeCompare(b.name);
                });

                resolve(items);
            });
        });
    }

    async downloadFile(remoteFilePath, localFilePath) {
        if (!this.sftpClient) await this.connectSftp();

        return new Promise((resolve, reject) => {
            this.sftpClient.fastGet(remoteFilePath, localFilePath, (err) => {
                if (err) return reject(err);
                resolve(localFilePath);
            });
        });
    }

    async uploadFile(localFilePath, remoteFilePath) {
        if (!this.sftpClient) await this.connectSftp();

        return new Promise((resolve, reject) => {
            this.sftpClient.fastPut(localFilePath, remoteFilePath, (err) => {
                if (err) return reject(err);
                resolve(remoteFilePath);
            });
        });
    }

    async deleteItem(remotePath, isDirectory = false) {
        if (!this.sftpClient) await this.connectSftp();

        return new Promise((resolve, reject) => {
            const action = isDirectory ? this.sftpClient.rmdir.bind(this.sftpClient) : this.sftpClient.unlink.bind(this.sftpClient);
            action(remotePath, (err) => {
                if (err) return reject(err);
                resolve(true);
            });
        });
    }

    async createDirectory(remotePath) {
        if (!this.sftpClient) await this.connectSftp();

        return new Promise((resolve, reject) => {
            this.sftpClient.mkdir(remotePath, (err) => {
                if (err) return reject(err);
                resolve(true);
            });
        });
    }

    requestSftpMount(device) {
        if (!device) return false;

        const requestPacket = {
            id: Date.now(),
            type: 'kdeconnect.sftp.request',
            body: { startBrowsing: true }
        };

        console.log(`[SftpPlugin] Requesting SFTP Mount from ${device.info.name}`);
        return device.sendPacket(requestPacket);
    }
}

module.exports = SftpPlugin;
