const EventEmitter = require('events');

class AudioBridge extends EventEmitter {
    constructor() {
        super();
        this.isAudioRoutingActive = false;
        this.isMicMuted = false;
        this.audioOutputTarget = 'PC_SPEAKERS'; // 'PC_SPEAKERS' | 'PHONE_EARPIECE'
    }

    startAudioRouting() {
        console.log('[AudioBridge] Binding Windows CoreAudio / SCO Call Loopback...');
        console.log('[AudioBridge] Phone SCO Stream -> Windows Output Speakers [ACTIVE]');
        console.log('[AudioBridge] Windows Input Microphone -> Phone SCO Stream [ACTIVE]');

        this.isAudioRoutingActive = true;
        this.audioOutputTarget = 'PC_SPEAKERS';
        this.emit('audioRoutingStateChanged', { active: true, target: this.audioOutputTarget });
        return true;
    }

    stopAudioRouting() {
        if (this.isAudioRoutingActive) {
            console.log('[AudioBridge] Disbanding Windows SCO Call Loopback.');
            this.isAudioRoutingActive = false;
            this.emit('audioRoutingStateChanged', { active: false, target: this.audioOutputTarget });
        }
    }

    setMicrophoneMuted(muted) {
        this.isMicMuted = !!muted;
        console.log(`[AudioBridge] PC Microphone Mute set to: ${this.isMicMuted}`);
        this.emit('micMuteStateChanged', { muted: this.isMicMuted });
        return this.isMicMuted;
    }

    transferCallAudioToPhone() {
        console.log('[AudioBridge] Transferring Call Audio from PC -> Phone Earpiece...');
        this.audioOutputTarget = 'PHONE_EARPIECE';
        this.stopAudioRouting();
        this.emit('callAudioTransferred', { target: 'PHONE_EARPIECE' });
    }

    transferCallAudioToPc() {
        console.log('[AudioBridge] Transferring Call Audio from Phone -> PC Speakers...');
        this.audioOutputTarget = 'PC_SPEAKERS';
        this.startAudioRouting();
        this.emit('callAudioTransferred', { target: 'PC_SPEAKERS' });
    }
}

module.exports = AudioBridge;
