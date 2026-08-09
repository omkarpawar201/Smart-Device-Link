import React, { useState, useEffect } from 'react';
import { Search, User, Phone, MessageSquare } from 'lucide-react';
import refreshIcon from './icons/refresh_icon.gif';

export default function Contacts({ device }) {
    const [contacts, setContacts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

    const fetchContacts = () => {
        setIsSyncing(true);
        if (window.api && typeof window.api.invoke === 'function') {
            const res = window.api.invoke('get-contacts');
            if (res && typeof res.then === 'function') {
                res.then((list) => {
                    if (Array.isArray(list)) setContacts(list);
                })
                    .catch((err) => console.error(err))
                    .finally(() => setTimeout(() => setIsSyncing(false), 750));
            }
        }
        if (window.api && window.api.send) {
            window.api.send('fetch-contacts');
        }
    };

    useEffect(() => {
        fetchContacts();

        if (window.api && window.api.onContactsUpdated) {
            window.api.onContactsUpdated((list) => {
                if (Array.isArray(list)) setContacts(list);
            });
        }
    }, []);

    const filteredContacts = contacts.filter(
        (c) =>
            (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (c.number && c.number.includes(searchQuery))
    );

    const getInitials = (name) => {
        if (!name) return '??';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1000px' }}>
            {/* Header Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Contacts Directory</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Synced phone contacts from {device?.name || 'your device'}.
                    </p>
                </div>

                <button className="btn-secondary" onClick={fetchContacts} disabled={isSyncing} style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <img src={refreshIcon} alt="Refresh" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Contacts'}</span>
                </button>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', maxWidth: '400px' }}>
                <Search size={16} style={{ position: 'absolute', left: '14px', top: '12px', color: 'var(--text-muted)' }} />
                <input
                    type="text"
                    className="input-glass"
                    placeholder="Search contacts by name or number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: '40px' }}
                />
            </div>

            {/* Contacts Grid */}
            {filteredContacts.length === 0 ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {contacts.length === 0 ? 'No contacts loaded yet. Tap "Sync Contacts" or ensure Contacts permission is enabled on your phone.' : 'No matching contacts found.'}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {filteredContacts.map((c) => (
                        <div
                            key={c.id || c.number}
                            className="glass-card animate-fade-in"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '16px'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                <div
                                    style={{
                                        width: '42px',
                                        height: '42px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
                                        color: '#ffffff',
                                        fontWeight: 700,
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}
                                >
                                    {getInitials(c.name)}
                                </div>

                                <div style={{ minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontWeight: 600,
                                            fontSize: '14px',
                                            color: 'var(--text-primary)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}
                                    >
                                        {c.name}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{c.number}</div>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                <button
                                    className="btn-secondary"
                                    style={{ padding: '8px', borderRadius: 'var(--radius-md)' }}
                                    title="Send SMS"
                                >
                                    <MessageSquare size={15} color="var(--accent-cyan)" />
                                </button>
                                <button
                                    className="btn-secondary"
                                    style={{ padding: '8px', borderRadius: 'var(--radius-md)' }}
                                    title="Call Contact"
                                >
                                    <Phone size={15} color="var(--accent-emerald)" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
