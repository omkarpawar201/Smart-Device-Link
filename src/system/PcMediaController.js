'use strict';

const { spawn } = require('child_process');
const path = require('path');

const CMD_TIMEOUT_MS = 5000;

// Windows-only controller that presses real system media keys and reads/writes the
// actual system master volume. Under the hood it keeps a single persistent PowerShell
// helper process alive and speaks a simple line protocol over stdin/stdout. Avoiding
// native modules keeps the app portable across Electron rebuilds/packaging.
//
// It tracks a best-effort `isPlaying` so explicit Play / Pause can be translated to a
// VK_MEDIA_PLAY_PAUSE toggle only when needed (Windows has no dedicated play/pause keys).
class PcMediaController {
    constructor() {
        this.child = null;
        this.startPromise = null;
        this.started = false;
        this.failed = false;
        this.waiters = [];
        this.buffer = '';
        this.isPlaying = false;
        this.volume = null;
        this.muted = false;
        this.onExit = () => this.dispose();
        process.on('exit', this.onExit);
    }

    _powershellPath() {
        if (process.env.SystemRoot) {
            return path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
        }
        return 'powershell.exe';
    }

    ensureStarted() {
        if (this.failed) return Promise.reject(new Error('PcMediaController unavailable'));
        if (this.started && this.child) return Promise.resolve();
        if (this.startPromise) return this.startPromise;
        this.startPromise = this._start();
        return this.startPromise;
    }

    _start() {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(__dirname, 'media-keys.ps1');
            let child;
            try {
                child = spawn(this._powershellPath(), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    windowsHide: true
                });
            } catch (err) {
                this._disable(err);
                reject(err);
                return;
            }

            this.child = child;
            child.stdout.on('data', (chunk) => this._onData(chunk));
            child.stderr.on('data', (chunk) => {
                const text = chunk.toString().trim();
                if (text) console.error('[PcMediaController] helper:', text);
            });
            child.on('error', (err) => {
                this._disable(err);
                reject(err);
            });
            child.on('exit', (code) => {
                this.child = null;
                this.started = false;
                this.startPromise = null;
                const err = new Error('media keys helper exited (' + code + ')');
                this._flushWaiters(err);
                reject(err);
            });

            // The helper's first stdout line is "ready".
            const startupWaiter = { resolve, reject, timer: null };
            this.waiters.push(startupWaiter);
        });
    }

    _onData(chunk) {
        this.buffer += chunk.toString();
        let idx;
        while ((idx = this.buffer.indexOf('\n')) >= 0) {
            const line = this.buffer.slice(0, idx).replace(/\r$/, '');
            this.buffer = this.buffer.slice(idx + 1);
            this._handleLine(line);
        }
    }

    _handleLine(line) {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (trimmed === 'ready' && !this.started) {
            this.started = true;
            const w = this.waiters.shift();
            if (w) {
                clearTimeout(w.timer);
                w.resolve();
            }
            return;
        }

        const w = this.waiters.shift();
        if (!w) return;
        clearTimeout(w.timer);

        const result = parseResult(trimmed);
        if (result && result.error) w.reject(new Error(result.error));
        else w.resolve(result || {});
    }

    _flushWaiters(err) {
        while (this.waiters.length) {
            const w = this.waiters.shift();
            clearTimeout(w.timer);
            w.reject(err);
        }
    }

    _disable(err) {
        this.failed = true;
        this.started = false;
        try {
            if (this.child) this.child.kill();
        } catch (e) { /* ignore */ }
        this._flushWaiters(err);
    }

    _request(cmd) {
        return this.ensureStarted()
            .then(() => new Promise((resolve, reject) => {
                if (!this.child) return reject(new Error('helper not running'));
                const waiter = {
                    resolve,
                    reject,
                    timer: setTimeout(() => {
                        const i = this.waiters.indexOf(waiter);
                        if (i >= 0) this.waiters.splice(i, 1);
                        reject(new Error('helper timeout: ' + cmd));
                    }, CMD_TIMEOUT_MS)
                };
                this.waiters.push(waiter);
                this.child.stdin.write(cmd + '\n');
            }));
    }

    play() {
        this.isPlaying = true;
        return this._request('play').catch((err) => { this.isPlaying = false; throw err; });
    }

    pause() {
        this.isPlaying = false;
        return this._request('pause').catch((err) => { this.isPlaying = true; throw err; });
    }

    playPause() {
        this.isPlaying = !this.isPlaying;
        return this._request('playpause').catch((err) => { this.isPlaying = !this.isPlaying; throw err; });
    }

    next() {
        return this._request('next');
    }

    previous() {
        return this._request('prev');
    }

    stop() {
        this.isPlaying = false;
        return this._request('stop').catch((err) => { this.isPlaying = true; throw err; });
    }

    // Relative seek by `ms` from the current position (the phone's seek bar sends a delta).
    seek(ms) {
        return this._request('seek ' + Math.round(Number(ms) || 0));
    }

    // Absolute seek to `ms` within the current track.
    setPos(ms) {
        return this._request('setpos ' + Math.round(Number(ms) || 0));
    }

    setVolume(volume) {
        const v = Math.max(0, Math.min(100, Math.round(Number(volume) || 0)));
        this.volume = v;
        return this._request('setvol ' + v).then((res) => {
            if (res && typeof res.volume === 'number') {
                this.volume = res.volume;
                this.muted = !!res.muted;
            }
            return res;
        });
    }

    getVolume() {
        return this._request('getvol').then((res) => {
            if (res && typeof res.volume === 'number') {
                this.volume = res.volume;
                this.muted = !!res.muted;
            }
            return res;
        });
    }

    // Real now-playing metadata + play state from the Windows media session (SMTC).
    // pos/length come in as milliseconds and are converted to seconds (renderer convention).
    // Also syncs `isPlaying` so Play/Pause decisions use the real session state.
    getNowPlaying() {
        return this._request('getnp').then((res) => {
            const np = {
                title: res.title || '',
                artist: res.artist || '',
                album: res.album || '',
                isPlaying: res.playing === true,
                pos: typeof res.pos === 'number' ? Math.round(res.pos / 1000) : 0,
                length: typeof res.length === 'number' ? Math.round(res.length / 1000) : 0
            };
            this.isPlaying = np.isPlaying;
            return np;
        });
    }

    dispose() {
        process.removeListener('exit', this.onExit);
        if (this.child) {
            try { this.child.stdin.end(); } catch (e) { /* ignore */ }
            try { this.child.kill(); } catch (e) { /* ignore */ }
            this.child = null;
        }
        this.started = false;
    }
}

function parseResult(line) {
    if (line === 'ok') return {};
    if (line.startsWith('err=')) return { error: line.slice(4) };
    const result = {};
    for (const part of line.split(';')) {
        const eq = part.indexOf('=');
        if (eq > 0) {
            const key = part.slice(0, eq).trim();
            const val = part.slice(eq + 1).trim();
            if (key === 'vol') {
                const n = Number(val);
                if (Number.isFinite(n)) result.volume = n;
            } else if (key === 'mute') {
                result.muted = val.toLowerCase() === 'true';
            } else if (key === 'playing') {
                result.playing = val.toLowerCase() === 'true';
            } else if (key === 'pos' || key === 'length') {
                const n = Number(val);
                if (Number.isFinite(n)) result[key] = n;
            } else if (key.indexOf('np_') === 0) {
                const name = key.slice(3);
                try {
                    result[name] = decodeURIComponent(val);
                } catch (e) {
                    result[name] = val;
                }
            }
        }
    }
    return result;
}

module.exports = PcMediaController;
