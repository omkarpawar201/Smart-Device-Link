import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Smartphone, Monitor, Volume2, User } from 'lucide-react';

export default function CallOverlay({ callData, onClose }) {
    const [callState, setCallState] = useState(callData || {
        name: 'Sarah Jenkins',
        number: '+1 (555) 234-5678',
        status: 'RINGING', // 'RINGING' | 'ACTIVE'
        isMuted: false,
        audioTarget: 'PC_SPEAKERS' // 'PC_SPEAKERS' | 'PHONE_EARPIECE'
    });

    const [durationSecs, setDurationSecs] = useState(0);

    useEffect(() => {
        let timer;
        if (callState.status === 'ACTIVE') {
            timer = setInterval(() => {
                setDurationSecs((prev) => prev + 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [callState.status]);

    const handleAnswer = () => {
        setCallState((prev) => ({ ...prev, status: 'ACTIVE' }));
        if (window.api && window.api.send) {
            window.api.send('answer-call-audio');
        }
    };

    const handleHangUp = () => {
        if (window.api && window.api.send) {
            window.api.send('hangup-call-audio');
        }
        if (onClose) onClose();
    };

    const handleToggleMute = () => {
        const newMute = !callState.isMuted;
        setCallState((prev) => ({ ...prev, isMuted: newMute }));
        if (window.api && window.api.send) {
            window.api.send('toggle-mute-audio', { muted: newMute });
        }
    };

    const handleToggleAudioTarget = () => {
        const newTarget = callState.audioTarget === 'PC_SPEAKERS' ? 'PHONE_EARPIECE' : 'PC_SPEAKERS';
        setCallState((prev) => ({ ...prev, audioTarget: newTarget }));
        if (window.api && window.api.send) {
            window.api.send('transfer-call-audio', { target: newTarget });
        }
    };

    const formatTimer = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div
            className="glass-panel animate-fade-in"
            style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                zIndex: 2000,
                width: '340px',
                padding: '24px',
                background: 'rgba(15, 23, 42, 0.92)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--border-glow)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '16px'
            }}
        >
            {/* Caller Avatar & Ringing Pulse */}
            <div
                className={callState.status === 'RINGING' ? 'pulse-glow' : ''}
                style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    fontWeight: 700
                }}
            >
                <User size={32} />
            </div>

            {/* Caller Info & Duration */}
            <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{callState.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{callState.number}</div>
                <div
                    style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: callState.status === 'ACTIVE' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                        marginTop: '6px'
                    }}
                >
                    {callState.status === 'RINGING' ? 'Incoming Phone Call...' : `Active Call • ${formatTimer(durationSecs)}`}
                </div>
            </div>

            {/* Interactive In-Call Control Toolbar */}
            {callState.status === 'ACTIVE' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginTop: '4px' }}>
                    <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                        {/* Mic Mute Button */}
                        <button
                            className="btn-secondary"
                            onClick={handleToggleMute}
                            style={{
                                flex: 1,
                                justifyContent: 'center',
                                background: callState.isMuted ? 'rgba(244, 63, 94, 0.2)' : 'var(--bg-glass)'
                            }}
                        >
                            {callState.isMuted ? <MicOff size={16} color="var(--accent-rose)" /> : <Mic size={16} />}
                            <span>{callState.isMuted ? 'Muted' : 'Mute'}</span>
                        </button>

                        {/* Audio Output Handoff Button */}
                        <button className="btn-secondary" onClick={handleToggleAudioTarget} style={{ flex: 1, justifyContent: 'center' }}>
                            {callState.audioTarget === 'PC_SPEAKERS' ? <Monitor size={16} color="var(--accent-cyan)" /> : <Smartphone size={16} />}
                            <span>{callState.audioTarget === 'PC_SPEAKERS' ? 'PC Audio' : 'Phone Audio'}</span>
                        </button>
                    </div>

                    {/* End Call Button */}
                    <button
                        className="btn-primary"
                        onClick={handleHangUp}
                        style={{
                            width: '100%',
                            justifyContent: 'center',
                            background: 'linear-gradient(135deg, var(--accent-rose), #e11d48)',
                            padding: '10px'
                        }}
                    >
                        <PhoneOff size={18} />
                        <span>End Call</span>
                    </button>
                </div>
            ) : (
                /* Incoming Call Answer / Decline Buttons */
                <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '4px' }}>
                    <button
                        className="btn-primary"
                        onClick={handleAnswer}
                        style={{
                            flex: 1,
                            justifyContent: 'center',
                            background: 'linear-gradient(135deg, var(--accent-emerald), #059669)',
                            padding: '10px'
                        }}
                    >
                        <Phone size={18} />
                        <span>Answer</span>
                    </button>

                    <button
                        className="btn-primary"
                        onClick={handleHangUp}
                        style={{
                            flex: 1,
                            justifyContent: 'center',
                            background: 'linear-gradient(135deg, var(--accent-rose), #e11d48)',
                            padding: '10px'
                        }}
                    >
                        <PhoneOff size={18} />
                        <span>Decline</span>
                    </button>
                </div>
            )}
        </div>
    );
}
