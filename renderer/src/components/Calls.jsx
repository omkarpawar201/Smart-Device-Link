import React, { useState } from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Delete, User, Mic, MicOff, Volume2 } from 'lucide-react';

export default function Calls({ device }) {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [activeCallState, setActiveCallState] = useState(null); // null | { name, number, duration, isMuted }
    const [callHistory, setCallHistory] = useState([
        { id: 'h1', type: 'incoming', name: 'Sarah Jenkins', number: '+1 (555) 234-5678', time: Date.now() - 1000 * 60 * 45, duration: '2m 14s' },
        { id: 'h2', type: 'missed', name: 'Unknown Caller', number: '+1 (555) 888-9999', time: Date.now() - 1000 * 60 * 180, duration: 'Missed' },
        { id: 'h3', type: 'outgoing', name: 'David Miller', number: '+1 (555) 987-6543', time: Date.now() - 1000 * 60 * 360, duration: '5m 40s' }
    ]);

    const dialpadKeys = [
        { num: '1', sub: '' },
        { num: '2', sub: 'ABC' },
        { num: '3', sub: 'DEF' },
        { num: '4', sub: 'GHI' },
        { num: '5', sub: 'JKL' },
        { num: '6', sub: 'MNO' },
        { num: '7', sub: 'PQRS' },
        { num: '8', sub: 'TUV' },
        { num: '9', sub: 'WXYZ' },
        { num: '*', sub: '' },
        { num: '0', sub: '+' },
        { num: '#', sub: '' }
    ];

    const handleKeyClick = (digit) => {
        setPhoneNumber((prev) => prev + digit);
    };

    const handleBackspace = () => {
        setPhoneNumber((prev) => prev.slice(0, -1));
    };

    const handleStartCall = (targetNum) => {
        const numToCall = targetNum || phoneNumber;
        if (!numToCall) return;

        setActiveCallState({
            name: numToCall,
            number: numToCall,
            duration: '00:01',
            isMuted: false
        });

        if (window.api && window.api.send) {
            window.api.send('dial-number', { number: numToCall });
        }
    };

    const handleEndCall = () => {
        if (activeCallState) {
            const newLog = {
                id: `h_${Date.now()}`,
                type: 'outgoing',
                name: activeCallState.name,
                number: activeCallState.number,
                time: Date.now(),
                duration: activeCallState.duration
            };
            setCallHistory((prev) => [newLog, ...prev]);
        }
        setActiveCallState(null);
    };

    const formatTime = (ts) => {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div
            className="animate-fade-in"
            style={{
                display: 'flex',
                gap: '24px',
                maxWidth: '1000px',
                margin: '0 auto'
            }}
        >
            {/* Left Area: Interactive Touch Dialpad */}
            <div
                className="glass-panel"
                style={{
                    width: '360px',
                    padding: '28px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '20px'
                }}
            >
                <h3 style={{ fontSize: '18px', fontWeight: 700, alignSelf: 'flex-start' }}>Phone Dialer</h3>

                {/* Number Display Bar */}
                <div
                    style={{
                        width: '100%',
                        height: '48px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 16px',
                        fontSize: '20px',
                        fontWeight: 700,
                        letterSpacing: '1px',
                        color: 'var(--text-primary)'
                    }}
                >
                    <span>{phoneNumber || 'Enter number...'}</span>
                    {phoneNumber.length > 0 && (
                        <button
                            onClick={handleBackspace}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                            <Delete size={20} />
                        </button>
                    )}
                </div>

                {/* Grid Numeric Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', width: '100%' }}>
                    {dialpadKeys.map((k) => (
                        <button
                            key={k.num}
                            onClick={() => handleKeyClick(k.num)}
                            style={{
                                height: '56px',
                                borderRadius: 'var(--radius-md)',
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid var(--border-glass)',
                                color: 'var(--text-primary)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-glass-hover)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')}
                        >
                            <span style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1 }}>{k.num}</span>
                            {k.sub && <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>{k.sub}</span>}
                        </button>
                    ))}
                </div>

                {/* Call Action Button */}
                <button
                    className="btn-primary"
                    onClick={() => handleStartCall()}
                    disabled={!phoneNumber}
                    style={{
                        width: '100%',
                        height: '48px',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, var(--accent-emerald), #059669)',
                        fontSize: '15px',
                        marginTop: '4px'
                    }}
                >
                    <Phone size={20} />
                    <span>Call Number</span>
                </button>
            </div>

            {/* Right Area: Call History Log or Active Call Screen */}
            <div className="glass-panel" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {activeCallState ? (
                    /* Active Ongoing Call Overlay Card */
                    <div
                        className="animate-fade-in"
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            gap: '20px'
                        }}
                    >
                        <div
                            className="pulse-glow"
                            style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: 'var(--accent-emerald)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <Phone size={36} />
                        </div>

                        <div>
                            <div style={{ fontSize: '22px', fontWeight: 700 }}>{activeCallState.name}</div>
                            <div style={{ fontSize: '14px', color: 'var(--accent-emerald)', fontWeight: 600, marginTop: '4px' }}>
                                Active Call • {activeCallState.duration}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                            <button
                                className="btn-secondary"
                                onClick={() => setActiveCallState((prev) => ({ ...prev, isMuted: !prev.isMuted }))}
                                style={{ padding: '12px 18px' }}
                            >
                                {activeCallState.isMuted ? <MicOff size={18} color="var(--accent-rose)" /> : <Mic size={18} />}
                                <span>{activeCallState.isMuted ? 'Muted' : 'Mute'}</span>
                            </button>

                            <button
                                className="btn-primary"
                                onClick={handleEndCall}
                                style={{ background: 'var(--accent-rose)', padding: '12px 24px' }}
                            >
                                <Phone size={18} />
                                <span>End Call</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Call Log List */
                    <>
                        <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Call History</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
                            {callHistory.map((item) => {
                                const isMissed = item.type === 'missed';
                                const isIncoming = item.type === 'incoming';

                                return (
                                    <div
                                        key={item.id}
                                        className="glass-card animate-fade-in"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '14px 18px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div
                                                style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '50%',
                                                    background: isMissed
                                                        ? 'rgba(244, 63, 94, 0.15)'
                                                        : isIncoming
                                                            ? 'rgba(16, 185, 129, 0.15)'
                                                            : 'rgba(56, 189, 248, 0.15)',
                                                    color: isMissed
                                                        ? 'var(--accent-rose)'
                                                        : isIncoming
                                                            ? 'var(--accent-emerald)'
                                                            : 'var(--accent-cyan)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                {isMissed ? <PhoneMissed size={18} /> : isIncoming ? <PhoneIncoming size={18} /> : <PhoneOutgoing size={18} />}
                                            </div>

                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '14px', color: isMissed ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                                                    {item.name}
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                    {item.number} • {formatTime(item.time)}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.duration}</span>
                                            <button
                                                className="btn-secondary"
                                                onClick={() => handleStartCall(item.number)}
                                                style={{ padding: '6px 12px', fontSize: '12px' }}
                                            >
                                                <Phone size={12} color="var(--accent-emerald)" />
                                                <span>Redial</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
