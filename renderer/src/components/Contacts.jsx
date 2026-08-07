import React, { useState, useEffect } from 'react';
import { Search, User, Phone, MessageSquare, RefreshCw } from 'lucide-react';

export default function Contacts({ device }) {
    const [contacts, setContacts] = useState([
        { id: 'c1', name: 'Alex Rivera', number: '+1 (555) 321-7654', numbers: ['+1 (555) 321-7654'] },
        { id: 'c2', name: 'David Miller', number: '+1 (555) 987-6543', numbers: ['+1 (555) 987-6543'] },
        { id: 'c3', name: 'Emma Watson', number: '+1 (555) 456-7890', numbers: ['+1 (555) 456-7890'] },
        { id: 'c4', name: 'Sarah Jenkins', number: '+1 (555) 234-5678', numbers: ['+1 (555) 234-5678'] }
    ]);

    const [searchQuery, setSearchQuery] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        if (window.api && window.api.onContactsUpdated) {
            window.api.onContactsUpdated((list) => {
                setContacts(list);
            });
        }
    }, []);

    const handleSync = () => {
        setIsSyncing(true);
        if (window.api && window.api.send) {
            window.api.send('fetch-contacts');
        }
        setTimeout(() => setIsSyncing(false), 2000);
    };

    const filteredContacts = contacts.filter(
        (c) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.number.includes(searchQuery)
    );

    const getInitials = (name) => {
        const parts = name.split(' ');
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

                <button className="btn-secondary" onClick={handleSync} disabled={isSyncing}>
                    <RefreshCw size={14} className={isSyncing ? 'pulse-glow' : ''} />
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {filteredContacts.map((c) => (
                    <div
                        key={c.id}
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
        </div>
    );
}
