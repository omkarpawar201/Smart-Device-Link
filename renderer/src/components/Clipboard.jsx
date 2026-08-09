import React, { useState, useEffect } from 'react';
import {
    Send,
    Copy,
    Trash2,
    Check,
    Loader,
    ArrowUpRight,
    ArrowDownLeft,
    ClipboardCopy,
    RefreshCw
} from 'lucide-react';
import refreshIcon from './icons/refresh_icon.gif';

export default function Clipboard({ device }) {
    const [history, setHistory] = useState([]);
    const [composer, setComposer] = useState('');
    const [autoSync, setAutoSync] = useState(true);
    const [copiedId, setCopiedId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const fetchHistory = () => {
        setIsLoading(true);
        if (window.api && typeof window.api.invoke === 'function') {
            window.api
                .invoke('get-clipboard-history')
                .then((list) => {
                    if (Array.isArray(list)) setHistory(list);
                })
                .catch((err) => console.error(err))
                .finally(() => setTimeout(() => setIsLoading(false), 500));
        } else {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();

        if (window.api && window.api.invoke) {
            window.api
                .invoke('get-clipboard-auto-sync')
                .then((v) => setAutoSync(!!v))
                .catch(() => {});
        }

        if (window.api && window.api.onClipboardReceived) {
            window.api.onClipboardReceived((item) => {
                if (!item || !item.content) return;
                setHistory((prev) => [item, ...prev.filter((h) => h.id !== item.id)].slice(0, 50));
            });
        }
    }, []);

    const handleSend = () => {
        const text = composer.trim();
        if (!text) return;
        if (window.api && window.api.send) {
            window.api.send('send-clipboard', { content: text });
        }
        setComposer('');
    };

    const handleToggleAutoSync = (val) => {
        setAutoSync(val);
        if (window.api && window.api.send) {
            window.api.send('set-clipboard-auto-sync', { enabled: val });
        }
    };

    const handleClear = () => {
        setHistory([]);
        if (window.api && window.api.send) {
            window.api.send('clear-clipboard-history');
        }
    };

    const handleCopy = (item) => {
        if (window.api && window.api.send) {
            window.api.send('set-pc-clipboard', { content: item.content });
        }
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 1200);
    };

    const handleSendToPhone = (item) => {
        if (window.api && window.api.send) {
            window.api.send('send-clipboard', { content: item.content });
        }
    };

    const handleRemove = (id) => {
        setHistory((prev) => prev.filter((h) => h.id !== id));
        if (window.api && window.api.send) {
            window.api.send('remove-clipboard-item', { id });
        }
    };

    const formatTime = (ts) => {
        if (!ts) return 'Just now';
        const mins = Math.floor((Date.now() - ts) / (1000 * 60));
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        return `${Math.floor(mins / 60)}h ago`;
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '850px' }}>
            {/* Header Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Shared Clipboard</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Automatic cross-device text sync with {device?.name || 'your phone'}.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        onClick={() => handleToggleAutoSync(!autoSync)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '12px',
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-md)',
                            border: autoSync ? '1px solid var(--border-glow)' : '1px solid var(--border)',
                            background: autoSync ? 'rgba(52, 211, 153, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                            color: autoSync ? 'var(--accent-green, #34d399)' : 'var(--text-secondary)',
                            cursor: 'pointer'
                        }}
                        title="Auto-sync PC clipboard changes to your phone"
                    >
                        <span
                            style={{
                                width: '26px',
                                height: '14px',
                                borderRadius: '999px',
                                background: autoSync ? 'rgba(52, 211, 153, 0.5)' : 'rgba(255, 255, 255, 0.15)',
                                position: 'relative',
                                transition: 'background 0.2s ease'
                            }}
                        >
                            <span
                                style={{
                                    position: 'absolute',
                                    top: '2px',
                                    left: autoSync ? '14px' : '2px',
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    background: autoSync ? '#34d399' : '#94a3b8',
                                    transition: 'left 0.2s ease'
                                }}
                            />
                        </span>
                        Auto-sync {autoSync ? 'On' : 'Off'}
                    </button>
                    <button className="btn-secondary" onClick={fetchHistory} disabled={isLoading} style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <img src={refreshIcon} alt="Refresh" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                        <span>Refresh</span>
                    </button>
                    {history.length > 0 && (
                        <button className="btn-secondary" onClick={handleClear} style={{ fontSize: '12px', padding: '6px 12px' }} title="Clear clipboard history">
                            <Trash2 size={13} color="var(--accent-rose)" />
                        </button>
                    )}
                </div>
            </div>

            {/* Compose / Send Panel */}
            <div className="glass-panel" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Send size={13} color="var(--accent-cyan)" />
                    Send text to your phone
                </div>
                <textarea
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSend();
                    }}
                    placeholder="Type or paste text here, then send it straight to the phone's clipboard..."
                    rows={3}
                    className="input-glass"
                    style={{ resize: 'vertical', fontSize: '13px', padding: '10px 12px', width: '100%', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn-primary" onClick={handleSend} disabled={!composer.trim()} style={{ fontSize: '12px', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Send size={13} />
                        Send to Phone
                    </button>
                </div>
            </div>

            {/* History */}
            {isLoading && history.length === 0 ? (
                <div className="glass-panel" style={{ padding: '50px', display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <Loader size={26} className="spin" color="var(--accent-cyan)" />
                </div>
            ) : history.length === 0 ? (
                <div className="glass-panel" style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <ClipboardCopy size={28} style={{ marginBottom: '10px', color: 'var(--text-muted)' }} />
                    <div style={{ fontSize: '13px' }}>
                        No clipboard items yet. Copy something on your phone with KDE Connect, or send text above.
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {history.map((item) => {
                        const isPc = item.source !== undefined && /pc|windows|computer/i.test(item.source);
                        const isExpanded = expandedId === item.id;
                        const preview = item.content.length > 180 && !isExpanded ? item.content.slice(0, 180) + '…' : item.content;

                        return (
                            <div key={item.id} className="glass-card animate-fade-in" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            letterSpacing: '0.5px',
                                            textTransform: 'uppercase',
                                            padding: '3px 8px',
                                            borderRadius: '999px',
                                            color: isPc ? 'var(--accent-cyan)' : 'var(--accent-violet)',
                                            background: isPc ? 'rgba(56, 189, 248, 0.12)' : 'rgba(167, 139, 250, 0.12)'
                                        }}
                                    >
                                        {isPc ? <ArrowUpRight size={11} /> : <ArrowDownLeft size={11} />}
                                        {isPc ? 'Sent to phone' : 'From phone'}
                                    </span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatTime(item.time)}</span>
                                    <div style={{ flex: 1 }} />
                                    <button className="btn-secondary" onClick={() => handleCopy(item)} style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }} title="Copy to PC clipboard">
                                        {copiedId === item.id ? <Check size={13} color="var(--accent-green, #34d399)" /> : <Copy size={13} />}
                                    </button>
                                    <button className="btn-secondary" onClick={() => handleSendToPhone(item)} style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }} title="Send to phone">
                                        <Send size={13} color="var(--accent-cyan)" />
                                    </button>
                                    <button className="btn-secondary" onClick={() => handleRemove(item.id)} style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }} title="Remove from history">
                                        <Trash2 size={13} color="var(--accent-rose)" />
                                    </button>
                                </div>

                                <div
                                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                    style={{
                                        fontSize: '13px',
                                        color: 'var(--text-primary)',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        lineHeight: 1.5,
                                        cursor: item.content.length > 180 ? 'pointer' : 'default'
                                    }}
                                    title={item.content.length > 180 ? (isExpanded ? 'Click to collapse' : 'Click to expand') : undefined}
                                >
                                    {preview}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
