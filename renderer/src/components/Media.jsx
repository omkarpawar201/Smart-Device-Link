import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
    Disc,
    Monitor,
    Smartphone,
    Music2,
    RefreshCw
} from 'lucide-react';

const EMPTY_PHONE = { available: false };
const PC_MEDIA_CACHE = {
    player: 'This PC',
    title: '',
    artist: '',
    album: '',
    isPlaying: false,
    volume: 50,
    pos: 0,
    length: 0,
    available: false
};

export default function Media({ device }) {
    const [phoneMedia, setPhoneMedia] = useState(EMPTY_PHONE);
    const [pcMedia, setPcMedia] = useState(() => ({ ...PC_MEDIA_CACHE }));

    const applyPcMedia = useCallback((updater) => {
        setPcMedia((prev) => {
            const patch = typeof updater === 'function' ? updater(prev) : updater;
            const merged = { ...prev, ...patch };
            Object.assign(PC_MEDIA_CACHE, merged);
            return merged;
        });
    }, []);

    // Ask the main process to drive the real system media session (media keys / SMTC /
    // master volume / seek).
    const sendPcCommand = useCallback((command) => {
        if (window.api && window.api.send) window.api.send('pc-media-command', command);
    }, []);

    const handlePcRequest = useCallback(
        (body) => {
            const { action, setVolume, seek, setPos, SetPosition, Seek } = body;
            if (typeof setVolume === 'number') {
                applyPcMedia({ volume: Math.max(0, Math.min(100, setVolume)) });
            } else if (action === 'Play') {
                applyPcMedia({ isPlaying: true });
            } else if (action === 'Pause' || action === 'Stop') {
                applyPcMedia({ isPlaying: false });
            } else if (action === 'PlayPause') {
                applyPcMedia((prev) => ({ isPlaying: !prev.isPlaying }));
            } else if (action === 'Next' || action === 'Previous') {
                console.log(`[Media] PC session received "${action}"`);
            } else if (typeof SetPosition === 'number') {
                applyPcMedia({ pos: Math.max(0, SetPosition / 1000) });
                sendPcCommand({ setPos: SetPosition });
            } else if (typeof Seek === 'number') {
                applyPcMedia((prev) => ({ pos: Math.max(0, (prev.pos || 0) + Seek / 1e6) }));
                sendPcCommand({ seek: Math.round(Seek / 1000) });
            } else if (action === 'Seek' && typeof seek === 'number') {
                applyPcMedia((prev) => ({ pos: Math.max(0, (prev.pos || 0) + seek / 1000) }));
                sendPcCommand({ seek });
            } else if (action === 'SetPos' && typeof setPos === 'number') {
                applyPcMedia({ pos: Math.max(0, setPos / 1000) });
                sendPcCommand({ setPos });
            }
        },
        [applyPcMedia, sendPcCommand]
    );

    const onPcAction = useCallback(
        (action) => {
            handlePcRequest({ action });
            sendPcCommand({ action });
        },
        [handlePcRequest, sendPcCommand]
    );

    const onPcVolume = useCallback(
        (volume) => {
            applyPcMedia({ volume: Math.max(0, Math.min(100, volume)) });
            sendPcCommand({ setVolume: Math.max(0, Math.min(100, volume)) });
        },
        [applyPcMedia, sendPcCommand]
    );

    const onPcSeek = useCallback(
        (posSecs) => {
            applyPcMedia({ pos: Math.max(0, posSecs) });
            sendPcCommand({ setPos: Math.round(posSecs * 1000) });
        },
        [applyPcMedia, sendPcCommand]
    );

    // Request the phone's current media state when the tab opens.
    useEffect(() => {
        if (window.api && window.api.send) {
            window.api.send('media-control', { action: 'GetState' });
        }
    }, []);

    // Listen for live phone media updates + phone->PC control requests.
    useEffect(() => {
        if (window.api && window.api.onMediaStateChanged) {
            window.api.onMediaStateChanged((m) => setPhoneMedia((prev) => ({ ...prev, ...m })));
        }
        if (window.api && window.api.onPcMediaRequest) {
            window.api.onPcMediaRequest(({ body }) => handlePcRequest(body));
        }
        // Real system media session (volume + now-playing) pushed from the main process.
        if (window.api && window.api.onPcMediaState) {
            window.api.onPcMediaState((state) => {
                if (typeof state.volume === 'number') {
                    state.volume = Math.max(0, Math.min(100, state.volume));
                }
                applyPcMedia(state);
            });
        }
    }, [handlePcRequest, applyPcMedia]);

    // The phone only reports `pos` when state changes, so advance the progress bar
    // locally while a track is playing (same as KDE Connect's desktop behaviour).
    useEffect(() => {
        const timer = setInterval(() => {
            setPhoneMedia((prev) => {
                if (!prev.isPlaying || !prev.length) return prev;
                return { ...prev, pos: (prev.pos || 0) + 1 };
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Same for the PC panel: the main process only pushes real state every ~2s, so advance
    // the PC progress bar locally while the session is playing to keep it smooth in real time.
    useEffect(() => {
        const timer = setInterval(() => {
            setPcMedia((prev) => {
                if (!prev.isPlaying || !prev.length) return prev;
                return { ...prev, pos: (prev.pos || 0) + 1 };
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Broadcast PC session changes to the phone (PC -> phone direction).
    useEffect(() => {
        if (window.api && window.api.send) {
            window.api.send('pc-media-state-changed', {
                player: pcMedia.player,
                title: pcMedia.title,
                artist: pcMedia.artist,
                album: pcMedia.album,
                isPlaying: pcMedia.isPlaying,
                volume: pcMedia.volume,
                pos: pcMedia.pos,
                length: pcMedia.length,
                available: !!(pcMedia.title || pcMedia.artist)
            });
        }
    }, [pcMedia]);

    // Expose the PC session to Windows media integration (SMTC) when available.
    useEffect(() => {
        if (!('mediaSession' in navigator)) return;
        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: pcMedia.title || '',
                artist: pcMedia.artist || '',
                album: pcMedia.album || ''
            });
            const setHandler = (action, fn) => {
                try {
                    navigator.mediaSession.setActionHandler(action, fn);
                } catch (e) {
                    /* unsupported action */
                }
            };
            setHandler('play', () => handlePcRequest({ action: 'Play' }));
            setHandler('pause', () => handlePcRequest({ action: 'Pause' }));
            setHandler('previoustrack', () => handlePcRequest({ action: 'Previous' }));
            setHandler('nexttrack', () => handlePcRequest({ action: 'Next' }));
            setHandler('seekto', (details) => {
                if (details && details.seekTime !== null && details.seekTime !== undefined) {
                    handlePcRequest({ action: 'SetPos', setPos: details.seekTime * 1000 });
                }
            });
            if ('setPositionState' in navigator.mediaSession) {
                navigator.mediaSession.setPositionState({
                    duration: pcMedia.length || 0,
                    position: pcMedia.pos || 0,
                    playbackRate: 1
                });
            }
        } catch (e) {
            console.warn('[Media] navigator.mediaSession unavailable:', e.message);
        }
    }, [pcMedia.title, pcMedia.artist, pcMedia.album, pcMedia.length, pcMedia.pos, handlePcRequest]);

    const handlePhoneAction = (action) => {
        // Optimistic feedback so the UI reacts instantly even before the phone echoes back.
        if (action === 'Play') setPhoneMedia((prev) => ({ ...prev, isPlaying: true }));
        else if (action === 'Pause') setPhoneMedia((prev) => ({ ...prev, isPlaying: false }));
        else if (action === 'PlayPause') setPhoneMedia((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
        if (window.api && window.api.send) {
            window.api.send('media-control', { action });
        }
        // Re-sync from the phone shortly after so the UI reflects the real state.
        setTimeout(() => window.api && window.api.send && window.api.send('media-control', { action: 'GetState' }), 400);
    };

    const handlePhoneVolume = (newVol) => {
        setPhoneMedia((prev) => ({ ...prev, volume: newVol }));
        if (window.api && window.api.send) {
            window.api.send('media-control', { action: 'setVolume', volume: newVol });
        }
    };

    const handlePhoneSeek = (posSecs) => {
        setPhoneMedia((prev) => ({ ...prev, pos: posSecs }));
        if (window.api && window.api.send) {
            window.api.send('media-control', { action: 'SetPos', setPos: Math.round(posSecs * 1000) });
        }
    };

    const formatTime = (secs) => {
        if (!secs || secs <= 0) return '0:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Draggable seek bar styled as a rounded gradient progress track with a thumb.
    // Click or drag anywhere on the track to seek (used for both the phone and PC players).
    const SeekBar = ({ pos, length, onSeek, disabled = false }) => {
        const trackRef = useRef(null);
        const [dragging, setDragging] = useState(false);
        const max = length > 0 ? length : 1;
        const pct = Math.min(100, Math.max(0, (pos / max) * 100));

        const seekFromClientX = (clientX) => {
            const track = trackRef.current;
            if (!track || disabled || !length) return;
            const rect = track.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
            onSeek(ratio * length);
        };

        return (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                    ref={trackRef}
                    onPointerDown={(e) => {
                        if (disabled || !length) return;
                        e.preventDefault();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setDragging(true);
                        seekFromClientX(e.clientX);
                    }}
                    onPointerMove={(e) => {
                        if (dragging) seekFromClientX(e.clientX);
                    }}
                    onPointerUp={() => setDragging(false)}
                    onPointerCancel={() => setDragging(false)}
                    style={{
                        position: 'relative',
                        width: '100%',
                        height: '16px',
                        cursor: disabled ? 'default' : 'pointer',
                        touchAction: 'none'
                    }}
                >
                    <div style={{ position: 'absolute', top: '5px', left: 0, right: 0, height: '5px', borderRadius: '999px', background: 'rgba(255, 255, 255, 0.1)' }} />
                    <div style={{ position: 'absolute', top: '5px', left: 0, height: '5px', width: `${pct}%`, borderRadius: '999px', background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-violet))' }} />
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: `calc(${pct}% - 8px)`,
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.4)',
                            transition: dragging ? 'none' : 'left 0.1s ease'
                        }}
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>{formatTime(pos)}</span>
                    <span>{formatTime(length)}</span>
                </div>
            </div>
        );
    };

    const renderPlayPause = (isPlaying, onToggle, disabled = false) => (
        <button
            className="btn-primary"
            onClick={onToggle}
            disabled={disabled}
            style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                opacity: disabled ? 0.4 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer'
            }}
        >
            {isPlaying ? <Pause size={24} /> : <Play size={24} style={{ marginLeft: '3px' }} />}
        </button>
    );

    const renderSkip = (dir, onAction, disabled = false) => (
        <button
            onClick={onAction}
            disabled={disabled}
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
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
                transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
                if (!disabled) e.currentTarget.style.background = 'var(--bg-glass-hover)';
            }}
            onMouseLeave={(e) => {
                if (!disabled) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
        >
            {dir === 'prev' ? <SkipBack size={20} /> : <SkipForward size={20} />}
        </button>
    );

    const renderVolume = (volume, onChange) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '220px' }}>
            <button onClick={() => onChange(volume > 0 ? 0 : 50)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input type="range" min="0" max="100" value={volume} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent-cyan)', cursor: 'pointer' }} />
        </div>
    );

    const hasPhoneMedia = phoneMedia.available || phoneMedia.title || phoneMedia.artist;

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Media Controller</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Bidirectional playback control between your PC and {device?.name || 'your phone'}.
                    </p>
                </div>
                <button
                    className="btn-secondary"
                    onClick={() => window.api && window.api.send && window.api.send('media-control', { action: 'GetState' })}
                    style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <RefreshCw size={13} color="var(--accent-cyan)" />
                    Sync Now
                </button>
            </div>

            {/* Phone Now Playing */}
            <div className="glass-panel" style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>
                    <Smartphone size={14} />
                    On Phone — controlled from PC
                </div>

                {!hasPhoneMedia ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No media currently playing on your phone.
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div
                                style={{
                                    width: '72px',
                                    height: '72px',
                                    borderRadius: '16px',
                                    background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-violet))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    overflow: 'hidden',
                                    animation: phoneMedia.isPlaying ? 'pulseGlow 3s infinite' : 'none'
                                }}
                            >
                                {phoneMedia.albumArt ? (
                                    <img src={phoneMedia.albumArt} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <Music2 size={30} color="#ffffff" />
                                )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {phoneMedia.title || 'Unknown track'}
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--accent-cyan)', fontWeight: 500, marginTop: '2px' }}>
                                    {phoneMedia.artist || 'Unknown artist'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {phoneMedia.album || 'Unknown album'}
                                    {phoneMedia.player ? ` • ${phoneMedia.player}` : ''}
                                </div>
                            </div>
                        </div>

                        {phoneMedia.length > 0 && (
                            <SeekBar pos={phoneMedia.pos} length={phoneMedia.length} onSeek={handlePhoneSeek} disabled={!phoneMedia.canSeek} />
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            {renderSkip('prev', () => handlePhoneAction('Previous'), !phoneMedia.canGoPrevious)}
                            {renderPlayPause(phoneMedia.isPlaying, () => handlePhoneAction('PlayPause'), !phoneMedia.canPlay && !phoneMedia.canPause)}
                            {renderSkip('next', () => handlePhoneAction('Next'), !phoneMedia.canGoNext)}
                        </div>

                        {typeof phoneMedia.volume === 'number' && phoneMedia.volume >= 0 && renderVolume(phoneMedia.volume, handlePhoneVolume)}
                    </>
                )}
            </div>

            {/* PC Now Playing */}
            <div className="glass-panel" style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '18px', borderColor: 'var(--border-glow)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--accent-violet)' }}>
                    <Monitor size={14} />
                    This PC — controlled from Phone
                </div>

                {!pcMedia.available && !device ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6 }}>
                        Connect a device to control this PC's media playback.
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div
                                style={{
                                    width: '72px',
                                    height: '72px',
                                    borderRadius: '16px',
                                    background: 'linear-gradient(135deg, var(--accent-violet), var(--accent-rose))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    animation: pcMedia.isPlaying ? 'pulseGlow 3s infinite' : 'none'
                                }}
                            >
                                <Disc size={30} color="#ffffff" className={pcMedia.isPlaying ? 'pulse-glow' : ''} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {pcMedia.title || 'Unknown track'}
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--accent-violet)', fontWeight: 500, marginTop: '2px' }}>
                                    {pcMedia.artist || 'Unknown artist'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {pcMedia.album || 'Unknown album'} • {pcMedia.player}
                                </div>
                            </div>
                        </div>

                        {pcMedia.length > 0 && (
                            <SeekBar pos={pcMedia.pos} length={pcMedia.length} onSeek={onPcSeek} />
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            {renderSkip('prev', () => onPcAction('Previous'))}
                            {renderPlayPause(pcMedia.isPlaying, () => onPcAction('PlayPause'))}
                            {renderSkip('next', () => onPcAction('Next'))}
                        </div>

                        {renderVolume(pcMedia.volume, onPcVolume)}
                    </>
                )}
            </div>
        </div>
    );
}
