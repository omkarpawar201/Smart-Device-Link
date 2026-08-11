const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const EventEmitter = require('events');

/**
 * Screen mirroring via scrcpy.
 *
 * scrcpy handles everything for us: H.264 capture (adb), low-latency decoding,
 * and input injection (tap/swipe/keyboard/buttons), and it works with a locked
 * phone screen. We just spawn it as a child process with the right flags.
 *
 * Binary resolution order for scrcpy / adb:
 *  1. explicit path from settings/env (SCRCPY_PATH, ADB)
 *  2. PATH lookup
 *  3. common install dirs (WinGet packages, etc.)
 */
class ScrcpyMirrorManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.scrcpyOverride = options.scrcpyPath || process.env.SCRCPY_PATH || null;
        this.adbOverride = options.adbPath || process.env.ADB || null;
        this.defaultSerial = options.defaultSerial || null;
        this.child = null;
        this.running = false;
        this.serial = null;
        this.startedAt = null;
        this.lastLog = [];
        this.restartCount = 0;
        this.stopRequested = false;
    }

    _commonDirs() {
        const dirs = [];
        if (process.platform === 'win32') {
            const wingetRoot = path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages');
            try {
                if (fs.existsSync(wingetRoot)) {
                    for (const entry of fs.readdirSync(wingetRoot)) {
                        if (!entry.startsWith('Genymobile.scrcpy')) continue;
                        const root = path.join(wingetRoot, entry);
                        try {
                            const walk = (dir) => {
                                for (const f of fs.readdirSync(dir)) {
                                    const full = path.join(dir, f);
                                    if (f === 'scrcpy.exe' || f === 'adb.exe') return full;
                                    if (fs.statSync(full).isDirectory()) {
                                        const hit = walk(full);
                                        if (hit) return hit;
                                    }
                                }
                                return null;
                            };
                            const exe = walk(root);
                            if (exe) dirs.push(path.dirname(exe));
                        } catch (e) {
                            /* ignore */
                        }
                    }
                }
            } catch (e) {
                /* ignore */
            }
        }
        return dirs;
    }

    resolveBin(name) {
        const override = name === 'scrcpy' ? this.scrcpyOverride : this.adbOverride;
        if (override && fs.existsSync(override)) return override;

        const inPath = this._which(name);
        if (inPath) return inPath;

        for (const dir of this._commonDirs()) {
            const candidate = path.join(dir, name === 'scrcpy' ? 'scrcpy.exe' : 'adb.exe');
            if (fs.existsSync(candidate)) return candidate;
            const noExt = path.join(dir, name);
            if (fs.existsSync(noExt)) return noExt;
        }
        return null;
    }

    _which(name) {
        try {
            const { execSync } = require('child_process');
            const isWin = process.platform === 'win32';
            const cmd = isWin ? `where ${name}` : `which ${name}`;
            const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
            const first = (out || '').split(/\r?\n/).find((l) => l.trim());
            return first && first.trim() ? first.trim() : null;
        } catch (e) {
            return null;
        }
    }

    getBins() {
        const scrcpy = this.resolveBin('scrcpy');
        let adb = this.resolveBin('adb');
        if (!adb && scrcpy) {
            const adbCandidate = path.join(path.dirname(scrcpy), 'adb.exe');
            if (fs.existsSync(adbCandidate)) adb = adbCandidate;
        }
        return { scrcpy, adb };
    }

    getStatus() {
        return {
            running: this.running,
            serial: this.serial,
            startedAt: this.startedAt,
            bins: this.getBins()
        };
    }

    async _runAdb(args) {
        return new Promise((resolve, reject) => {
            const { adb } = this.getBins();
            if (!adb) return reject(new Error('adb not found. Install scrcpy (which bundles adb) or set the ADB env var.'));
            execFile(adb, args, { timeout: 15000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
                if (err) return reject(new Error((stderr || err.message || '').trim()));
                resolve((stdout || '').trim());
            });
        });
    }

    async _deviceState(serial) {
        const out = await this._runAdb(['devices']);
        const line = (out || '').split(/\r?\n/).find((l) => l.startsWith(serial + '\t'));
        return line ? line.split(/\s+/)[1] || null : null;
    }

    /**
     * MIUI/POCO drops the adb-over-Wi-Fi link when the screen locks. Re-establish
     * it (pairing keys persist on the PC, so `adb connect` is enough) before
     * handing the serial to scrcpy.
     */
    async ensureDeviceOnline(serial) {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        if (await this._deviceState(serial) === 'device') return;

        const attempts = [
            () => this._runAdb(['reconnect', 'offline']),
            () => this._runAdb(['reconnect']),
            () => this._runAdb(['connect', serial])
        ];
        for (const attempt of attempts) {
            try {
                await attempt();
            } catch (e) {
                /* keep trying */
            }
            await sleep(2000);
            if (await this._deviceState(serial) === 'device') return;
        }
        throw new Error(`Phone ${serial} is offline. Unlock it once and confirm Wireless Debugging is still on, then retry.`);
    }

    async listDevices() {
        const bins = this.getBins();
        const out = await this._runAdb(['devices', '-l']);
        const lines = out.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('List of devices'));
        const devices = lines.map((line) => {
            const parts = line.split(/\s+/);
            const serial = parts[0];
            const state = parts[1] || 'unknown';
            const modelMatch = line.match(/model:(\S+)/);
            const deviceMatch = line.match(/device:(\S+)/);
            return {
                serial,
                state,
                model: modelMatch ? modelMatch[1] : null,
                kind: deviceMatch ? deviceMatch[1] : null,
                isTcpip: /^\d+\.\d+\.\d+\.\d+:\d+$/.test(serial)
            };
        });
        return { ok: true, ...bins, devices };
    }

    pickSerial(devices, preferred) {
        if (preferred) return preferred;
        if (this.defaultSerial) return this.defaultSerial;
        const online = devices.filter((d) => d.state === 'device');
        if (!online.length) return null;
        const tcp = online.find((d) => d.isTcpip);
        return tcp ? tcp.serial : online[0].serial;
    }

    _spawnScrcpy(serial, options) {
        const bins = this.getBins();
        const args = ['-s', serial, '--window-title', options.windowTitle || 'Diy Phone Link - Screen Mirror'];
        if (options.maxSize) args.push('--max-size', String(options.maxSize));
        if (options.maxFps) args.push('--max-fps', String(options.maxFps));
        if (options.turnScreenOff) args.push('--turn-screen-off');
        if (options.stayAwake !== false) args.push('--stay-awake');
        if (options.noAudio) args.push('--no-audio');
        if (options.noVideoPlayback) args.push('--no-video-playback');

        const scrcpyDir = path.dirname(bins.scrcpy);
        const env = {
            ...process.env,
            ADB: bins.adb || '',
            PATH: scrcpyDir + path.delimiter + (process.env.PATH || '')
        };

        return spawn(bins.scrcpy, args, { env, windowsHide: false });
    }

    async start(options = {}) {
        if (this.running) {
            this.emit('status', this.getStatus());
            return this.getStatus();
        }

        const bins = this.getBins();
        if (!bins.scrcpy) throw new Error('scrcpy not found. Install it (winget install Genymobile.scrcpy) or set SCRCPY_PATH.');

        const list = await this.listDevices();
        const serial = this.pickSerial(list.devices || [], options.serial);
        if (!serial) {
            throw new Error('No Android device connected over adb. Enable Wireless Debugging on the phone and run adb connect <ip>:<port>.');
        }

        await this.ensureDeviceOnline(serial);

        let lastOutcome = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
            let child;
            try {
                child = this._spawnScrcpy(serial, options);
            } catch (err) {
                throw new Error(`Failed to launch scrcpy: ${err.message}`);
            }

            child.stdout.on('data', (d) => this._log('info', d.toString()));
            child.stderr.on('data', (d) => this._log('error', d.toString()));

            let established = false;
            const outcome = await new Promise((resolve) => {
                child.once('error', (err) => resolve({ error: err }));
                child.once('exit', (code, signal) => resolve({ code, signal }));
                child.on('exit', (code, signal) => {
                    if (!established) return;
                    this.running = false;
                    this.child = null;
                    if (code === 0 || signal || this.stopRequested) {
                        this.emit('status', { running: false, serial: null, exitCode: code, signal });
                        return;
                    }
                    if (this.restartCount < 3) {
                        this.restartCount += 1;
                        this._log('error', `scrcpy exited (code ${code}); reconnecting adb and restarting (${this.restartCount}/3)...`);
                        this.emit('status', { running: false, serial: null, exitCode: code, error: 'Phone connection dropped (MIUI). Reconnecting...' });
                        setTimeout(() => {
                            if (this.stopRequested) return;
                            this.ensureDeviceOnline(serial)
                                .then(() => this.start(options))
                                .catch(() => {
                                    if (this.stopRequested) return;
                                    this.emit('status', { running: false, error: 'Auto-restart failed: phone offline. Unlock it and confirm Wireless Debugging is on.' });
                                });
                        }, 1500);
                    } else {
                        this.emit('status', {
                            running: false,
                            serial: null,
                            exitCode: code,
                            error: `scrcpy stopped (code ${code}) after ${this.restartCount} auto-restarts. Reconnect and press Start again.`
                        });
                    }
                });
                const timer = setTimeout(() => {
                    established = true;
                    resolve('up');
                }, 5000);
                child.once('close', () => clearTimeout(timer));
            });

            if (outcome === 'up') {
                this.restartCount = 0;
                this.stopRequested = false;
                this.child = child;
                this.running = true;
                this.serial = serial;
                this.startedAt = Date.now();
                this.emit('status', { running: true, serial });
                return this.getStatus();
            }

            lastOutcome = outcome;
            const reason = outcome && outcome.error
                ? `launch error (${outcome.error.code || outcome.error.message})`
                : `code ${outcome && outcome.code}`;
            this._log('error', `scrcpy failed during startup (${reason}); attempt ${attempt}/3`);

            if (attempt < 3) {
                await new Promise((r) => setTimeout(r, 1000));
                try {
                    await this.ensureDeviceOnline(serial);
                } catch (e) {
                    /* keep retrying */
                }
            }
        }

        this.running = false;
        this.serial = null;
        this.startedAt = null;
        const detail = lastOutcome && lastOutcome.error ? lastOutcome.error.message : `scrcpy exited with code ${lastOutcome && lastOutcome.code}`;
        this.emit('status', {
            running: false,
            error: `Could not start screen mirror: ${detail}. The Wi-Fi adb link may have dropped (MIUI drops it when the screen locks).\n${this.lastLog.slice(-10).join('\n')}`
        });
        return this.getStatus();
    }

    _log(level, text) {
        const line = text.trim();
        if (!line) return;
        this.lastLog.push(`[${level}] ${line}`);
        if (this.lastLog.length > 200) this.lastLog.splice(0, this.lastLog.length - 200);
        console.log(`[ScrcpyMirror] ${line}`);
        this.emit('log', { level, line });
    }

    async stop() {
        this.stopRequested = true;
        const child = this.child;
        if (!child) {
            this.running = false;
            this.emit('status', this.getStatus());
            return;
        }
        this.running = false;
        this.child = null;
        if (process.platform === 'win32') {
            try {
                await new Promise((resolve) => {
                    const { execFile } = require('child_process');
                    execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], () => resolve());
                });
            } catch (e) {
                child.kill();
            }
        } else {
            child.kill();
        }
        this.serial = null;
        this.startedAt = null;
        this.emit('status', this.getStatus());
    }
}

module.exports = ScrcpyMirrorManager;
