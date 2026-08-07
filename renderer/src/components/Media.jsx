import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Music, Disc } from 'lucide-react';

export default function Media({ device }) {
    const [media, setMedia] = useState({
        player: 'Spotify',
        title: 'Midnight City',
        artist: 'M83',
        album: 'Hurry Up, We\'re Dreaming',
        isPlaying: true,
        volume: 75,
        pos: 84, // seconds
        length: 243 // seconds
    });

    useEffect(() => {
        // Listen for live media playback updates from Electron main process
        if (window.api && window.api.onMediaStateChanged) {
            window.api.onMediaStateChanged((newMedia) => {
                setMedia((prev) => ({ ...prev, ...newMedia }));
            });
        }
    }, []);

    const handleAction = (action) => {
        if (action === 'PlayPause') {
            setMedia((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
        }
        if (window.api && window.api.send) {
            window.api.send('media-control', { action });
        }
    };

    const handleVolumeChange = (newVol) => {
        setMedia((prev) => ({ ...prev, volume: newVol }));
        if (window.api && window.api.send) {
            window.api.send('media-control', { action: 'setVolume', volume: newVol });
        }
    };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '750px' }}>
            {/* Header */}
            <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Media Controller</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Control audio playback on {device?.name || 'your phone'}.
                </p>
            </div>

            {/* Main Glassmorphic Media Player Card */}
            <div
                className="glass-panel animate-fade-in"
                style={{
                    padding: '36px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '24px',
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {/* Album Art Preview Disk */}
                <div
                    style={{
                        width: '140px',
                        height: '140px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-violet), var(--accent-cyan))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 10px 30px rgba(139, 92, 246, 0.3)',
                        animation: media.isPlaying ? 'pulseGlow 3s infinite' : 'none'
                    }}
                >
                    <Disc size={64} color="#ffffff" className={media.isPlaying ? 'pulse-glow' : ''} />
                </div>

                {/* Track Title & Artist */}
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{media.title}</div>
                    <div style={{ fontSize: '14px', color: 'var(--accent-cyan)', fontWeight: 500, marginTop: '4px' }}>
                        {media.artist}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {media.album} • {media.player}
                    </div>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div
                        style={{
                            width: '100%',
                            height: '6px',
                            borderRadius: '999px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            overflow: 'hidden',
                            cursor: 'pointer'
                        }}
                    >
                        <div
                            style={{
                                width: `${(media.pos / media.length) * 100}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-violet))',
                                borderRadius: '999px',
                                transition: 'width 0.3s ease'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span>{formatTime(media.pos)}</span>
                        <span>{formatTime(media.length)}</span>
                    </div>
                </div>

                {/* Controls Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <button
                        onClick={() => handleAction('Previous')}
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-glass)',
                            color: 'var(--text-primary)',
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-glass-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                    >
                        <SkipBack size={20} />
                    </button>

                    <button
                        onClick={() => handleAction('PlayPause')}
                        className="btn-primary"
                        style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0
                        }}
                    >
                        {media.isPlaying ? <Pause size={24} /> : <Play size={24} style={{ marginLeft: '3px' }} />}
                    </button>

                    <button
                        onClick={() => handleAction('Next')}
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-glass)',
                            color: 'var(--text-primary)',
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-glass-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                    >
                        <SkipForward size={20} />
                    </button>
                </div>

                {/* Volume Slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '220px', marginTop: '8px' }}>
                    <button
                        onClick={() => handleVolumeChange(media.volume > 0 ? 0 : 50)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                        {media.volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={media.volume}
                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                        style={{ flex: 1, accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
                    />
                </div>
            </div>
        </div>
    );
}
