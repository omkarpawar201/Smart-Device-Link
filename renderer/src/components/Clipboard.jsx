import React, { useState, useEffect } from 'react';
import { Clipboard as ClipboardIcon, Copy, Send, Check, Smartphone, Monitor } from 'lucide-react';

export default function Clipboard({ device }) {
    const [history, setHistory] = useState([
        {
            id: 'clip_1',
            content: 'https://github.com/omkarpawar201/Smart-Device-Link',
            source: device?.name || 'Galaxy S23 Ultra',
            time: Date.now() - 1000 * 60 * 5
        },
        {
            id: 'clip_2',
            content: 'Meeting passcode: 849204',
            source: 'Windows PC',
            time: Date.now() - 1000 * 60 * 25
        }
    ]);

    const [inputContent, setInputContent] = useState('');
    const [copiedId, setCopiedId] = useState(null);

    useEffect(() => {
        // Listen for incoming live clipboard sync from Electron main process
        if (window.api && window.api.onClipboardReceived) {
            window.api.onClipboardReceived((item) => {
                setHistory((prev) => [item, ...prev.filter((i) => i.id !== item.id)]);
            });
        }
    }, []);

    const handleSendToPhone = () => {
        if (!inputContent.trim()) return;

        if (window.api && window.api.send) {
            window.api.send('send-clipboard', { content: inputContent.trim() });
        }

        const newItem = {
            id: `clip_${Date.now()}`,
            content: inputContent.trim(),
            source: 'Windows PC',
            time: Date.now()
        };

        setHistory((prev) => [newItem, ...prev]);
        setInputContent('');
    };

    const handleCopy = (id, text) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const formatTime = (ts) => {
        const mins = Math.floor((Date.now() - ts) / (1000 * 60));
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        return `${Math.floor(mins / 60)}h ago`;
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '850px' }}>
            {/* Header */}
            <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Shared Clipboard</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Text copied on your PC or phone is automatically synchronized across both devices.
                </p>
            </div>

            {/* Manual Send Widget */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Send Custom Text to Phone Clipboard
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="text"
                        className="input-glass"
                        placeholder="Type or paste text to push to phone..."
                        value={inputContent}
                        onChange={(e) => setInputContent(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendToPhone()}
                    />
                    <button className="btn-primary" onClick={handleSendToPhone} style={{ whiteSpace: 'nowrap' }}>
                        <Send size={15} />
                        <span>Send to Phone</span>
                    </button>
                </div>
            </div>

            {/* Clipboard History Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                    CLIPBOARD HISTORY
                </h3>

                {history.map((item) => (
                    <div
                        key={item.id}
                        className="glass-card animate-fade-in"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px 20px',
                            gap: '16px'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                            <div
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: 'var(--radius-md)',
                                    background: item.source.includes('PC') ? 'rgba(139, 92, 246, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                    color: item.source.includes('PC') ? 'var(--accent-violet)' : 'var(--accent-cyan)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}
                            >
                                {item.source.includes('PC') ? <Monitor size={18} /> : <Smartphone size={18} />}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    style={{
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: 'var(--text-primary)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}
                                >
                                    {item.content}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    From {item.source} • {formatTime(item.time)}
                                </div>
                            </div>
                        </div>

                        <button
                            className="btn-secondary"
                            onClick={() => handleCopy(item.id, item.content)}
                            style={{ padding: '8px 14px', fontSize: '12px', flexShrink: 0 }}
                        >
                            {copiedId === item.id ? <Check size={14} color="var(--accent-emerald)" /> : <Copy size={14} />}
                            <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
