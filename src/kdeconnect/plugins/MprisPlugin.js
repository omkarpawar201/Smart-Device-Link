const BasePlugin = require('./BasePlugin');

class MprisPlugin extends BasePlugin {
    constructor(eventEmitter) {
        super('MprisPlugin');
        this.emitter = eventEmitter;
        this.mediaState = {
            player: 'Spotify',
            title: 'Midnight City',
            artist: 'M83',
            album: 'Hurry Up, We\'re Dreaming',
            isPlaying: false,
            volume: 75,
            pos: 45,
            length: 243
        };
    }

    getCapabilities() {
        return ['kdeconnect.mpris', 'kdeconnect.mpris.request'];
    }

    handlePacket(device, packet) {
        if (packet.type === 'kdeconnect.mpris') {
            const body = packet.body || {};

            this.mediaState = {
                player: body.player || this.mediaState.player,
                title: body.nowPlaying || body.title || this.mediaState.title,
                artist: body.artist || this.mediaState.artist,
                album: body.album || this.mediaState.album,
                isPlaying: typeof body.isPlaying === 'boolean' ? body.isPlaying : this.mediaState.isPlaying,
                volume: typeof body.volume === 'number' ? body.volume : this.mediaState.volume,
                pos: typeof body.pos === 'number' ? Math.floor(body.pos / 1000) : this.mediaState.pos,
                length: typeof body.length === 'number' ? Math.floor(body.length / 1000) : this.mediaState.length,
                updatedAt: Date.now()
            };

            console.log(`[MprisPlugin] ${device.info.name} Media: "${this.mediaState.title}" by ${this.mediaState.artist} [${this.mediaState.isPlaying ? 'PLAYING' : 'PAUSED'}]`);

            if (this.emitter) {
                this.emitter.emit('mediaStateChanged', {
                    deviceId: device.info.id,
                    ...this.mediaState
                });
            }
        }
    }

    sendAction(device, action) {
        if (!device || !action) return false;

        // Valid actions: "Play", "Pause", "PlayPause", "Next", "Previous"
        const actionPacket = {
            id: Date.now(),
            type: 'kdeconnect.mpris.request',
            body: {
                action: action
            }
        };

        console.log(`[MprisPlugin] Sending action "${action}" to ${device.info.name}`);
        return device.sendPacket(actionPacket);
    }

    setVolume(device, volume) {
        if (!device) return false;

        const volumePacket = {
            id: Date.now(),
            type: 'kdeconnect.mpris.request',
            body: {
                setVolume: Math.min(100, Math.max(0, volume))
            }
        };

        return device.sendPacket(volumePacket);
    }
}

module.exports = MprisPlugin;
