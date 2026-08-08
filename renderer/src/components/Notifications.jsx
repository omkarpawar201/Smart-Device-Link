import React, { useState } from 'react';
import { Send, Trash2, CheckCircle2, Smartphone } from 'lucide-react';
import refreshIcon from './icons/refresh_icon.gif';

export default function Notifications({ device, notifications = [], setNotifications }) {
    const [replyInputs, setReplyInputs] = useState({});
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchNotifications = () => {
        setIsRefreshing(true);
        if (window.api && typeof window.api.invoke === 'function') {
            const res = window.api.invoke('get-notifications');
            if (res && typeof res.then === 'function') {
                res.then((list) => {
                    if (Array.isArray(list)) setNotifications(list);
                })
                    .catch((err) => console.error(err))
                    .finally(() => {
                        setTimeout(() => setIsRefreshing(false), 750);
                    });
                return;
            }
        }
        setTimeout(() => setIsRefreshing(false), 750);
    };

    const handleReplyChange = (id, text) => {
        setReplyInputs((prev) => ({ ...prev, [id]: text }));
    };

    const handleSendReply = (id, requestReplyId) => {
        const text = replyInputs[id];
        if (!text || !text.trim()) return;

        if (window.api && window.api.send) {
            window.api.send('send-reply', { requestReplyId, text: text.trim() });
        }

        setReplyInputs((prev) => ({ ...prev, [id]: '' }));
    };

    const handleDismiss = (id) => {
        if (window.api && window.api.send) {
            window.api.send('dismiss-notification', { id });
        }
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    };

    const handleClearFeed = () => {
        setNotifications([]);
        if (window.api && window.api.send) {
            window.api.send('clear-all-notifications');
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Notification Center</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Live notifications from {device?.name || 'your phone'}.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-secondary" onClick={fetchNotifications} disabled={isRefreshing} style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <img src={refreshIcon} alt="Refresh" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                        <span>{isRefreshing ? 'Refreshing...' : 'Refresh Sync'}</span>
                    </button>
                    {notifications.length > 0 && (
                        <button className="btn-secondary" onClick={handleClearFeed} style={{ fontSize: '12px', padding: '6px 12px' }}>
                            Clear Feed ({notifications.length})
                        </button>
                    )}
                </div>
            </div>

            {notifications.length === 0 ? (
                <div
                    className="glass-panel"
                    style={{
                        padding: '50px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center'
                    }}
                >
                    <div
                        style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'rgba(56, 189, 248, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent-cyan)',
                            marginBottom: '14px'
                        }}
                    >
                        <CheckCircle2 size={28} />
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>All Caught Up!</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        No active phone notifications right now.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {notifications.map((notif) => (
                        <div
                            key={notif.id}
                            className="glass-card animate-fade-in"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                padding: '16px 20px',
                                borderLeft: '3px solid var(--accent-cyan)'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div
                                        style={{
                                            padding: '4px 8px',
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'rgba(56, 189, 248, 0.15)',
                                            color: 'var(--accent-cyan)',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <Smartphone size={12} />
                                        <span>{notif.appName}</span>
                                    </div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatTime(notif.time)}</span>
                                </div>

                                {notif.isClearable && (
                                    <button
                                        onClick={() => handleDismiss(notif.id)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--text-muted)',
                                            cursor: 'pointer',
                                            padding: '4px'
                                        }}
                                        title="Dismiss notification on phone"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                )}
                            </div>

                            <div>
                                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{notif.title}</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
                                    {notif.text}
                                </div>
                            </div>

                            {notif.requestReplyId && (
                                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                    <input
                                        type="text"
                                        className="input-glass"
                                        placeholder={`Reply to ${notif.title}...`}
                                        value={replyInputs[notif.id] || ''}
                                        onChange={(e) => handleReplyChange(notif.id, e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendReply(notif.id, notif.requestReplyId)}
                                        style={{ fontSize: '13px', padding: '8px 12px' }}
                                    />
                                    <button
                                        className="btn-primary"
                                        onClick={() => handleSendReply(notif.id, notif.requestReplyId)}
                                        style={{ padding: '8px 14px', fontSize: '12px' }}
                                    >
                                        <Send size={14} />
                                        <span>Reply</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
