import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Search, User, Phone, CheckCheck } from 'lucide-react';

export default function Messages({ device }) {
    const [threads, setThreads] = useState([
        {
            threadId: 't1',
            address: '+1 (555) 234-5678',
            contactName: 'Sarah Jenkins',
            lastMessage: 'Sounds good! See you tomorrow at the office.',
            lastDate: Date.now() - 1000 * 60 * 12,
            messages: [
                { id: 'm1', body: 'Hey! Are we still reviewing the proposal?', date: Date.now() - 1000 * 60 * 30, type: 1 },
                { id: 'm2', body: 'Yes, I just finished revising section 3.', date: Date.now() - 1000 * 60 * 20, type: 2 },
                { id: 'm3', body: 'Sounds good! See you tomorrow at the office.', date: Date.now() - 1000 * 60 * 12, type: 1 }
            ]
        },
        {
            threadId: 't2',
            address: '+1 (555) 987-6543',
            contactName: 'David Miller',
            lastMessage: 'Can you send over the updated PDF file?',
            lastDate: Date.now() - 1000 * 60 * 120,
            messages: [
                { id: 'm4', body: 'Can you send over the updated PDF file?', date: Date.now() - 1000 * 60 * 120, type: 1 }
            ]
        }
    ]);

    const [activeThreadId, setActiveThreadId] = useState('t1');
    const [inputText, setInputText] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const messagesEndRef = useRef(null);

    const activeThread = threads.find((t) => t.threadId === activeThreadId) || threads[0];

    useEffect(() => {
        if (window.api && window.api.onSmsThreadsUpdated) {
            window.api.onSmsThreadsUpdated((updatedThreads) => {
                setThreads(updatedThreads);
            });
        }
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeThreadId, activeThread?.messages]);

    const handleSendMessage = () => {
        if (!inputText.trim() || !activeThread) return;

        const newMsg = {
            id: `msg_${Date.now()}`,
            threadId: activeThread.threadId,
            address: activeThread.address,
            body: inputText.trim(),
            date: Date.now(),
            type: 2 // Outgoing
        };

        if (window.api && window.api.send) {
            window.api.send('send-sms', {
                phoneNumber: activeThread.address,
                messageText: inputText.trim()
            });
        }

        // Optimistic UI update
        setThreads((prev) =>
            prev.map((t) => {
                if (t.threadId === activeThread.threadId) {
                    return {
                        ...t,
                        lastMessage: newMsg.body,
                        lastDate: newMsg.date,
                        messages: [...t.messages, newMsg]
                    };
                }
                return t;
            })
        );

        setInputText('');
    };

    const filteredThreads = threads.filter(
        (t) =>
            t.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.address.includes(searchQuery) ||
            t.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatTime = (ts) => {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div
            className="animate-fade-in"
            style={{
                display: 'flex',
                height: 'calc(100vh - 120px)',
                gap: '16px',
                maxWidth: '1100px',
                margin: '0 auto'
            }}
        >
            {/* Left Column: Conversations List */}
            <div
                className="glass-panel"
                style={{
                    width: '320px',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '16px',
                    gap: '12px'
                }}
            >
                <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)' }}>Messages</div>

                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        className="input-glass"
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ paddingLeft: '36px', fontSize: '13px' }}
                    />
                </div>

                {/* Threads List */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {filteredThreads.map((t) => {
                        const isActive = t.threadId === activeThreadId;
                        return (
                            <div
                                key={t.threadId}
                                onClick={() => setActiveThreadId(t.threadId)}
                                style={{
                                    padding: '12px',
                                    borderRadius: 'var(--radius-md)',
                                    background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                    border: isActive ? '1px solid var(--border-glow)' : '1px solid transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '14px', color: isActive ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                                        {t.contactName}
                                    </span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatTime(t.lastDate)}</span>
                                </div>
                                <div
                                    style={{
                                        fontSize: '12px',
                                        color: 'var(--text-secondary)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}
                                >
                                    {t.lastMessage}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right Column: Chat Thread View */}
            {activeThread ? (
                <div
                    className="glass-panel"
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}
                >
                    {/* Active Contact Header */}
                    <div
                        style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid var(--border-glass)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'rgba(15, 23, 42, 0.4)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                                style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '50%',
                                    background: 'rgba(56, 189, 248, 0.15)',
                                    color: 'var(--accent-cyan)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700
                                }}
                            >
                                <User size={20} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '15px' }}>{activeThread.contactName}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{activeThread.address}</div>
                            </div>
                        </div>

                        <button className="btn-secondary" style={{ padding: '8px 12px', fontSize: '12px' }}>
                            <Phone size={14} />
                            <span>Call</span>
                        </button>
                    </div>

                    {/* Messages Bubble Area */}
                    <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {activeThread.messages.map((m) => {
                            const isOutgoing = m.type === 2;
                            return (
                                <div
                                    key={m.id}
                                    style={{
                                        alignSelf: isOutgoing ? 'flex-end' : 'flex-start',
                                        maxWidth: '65%'
                                    }}
                                >
                                    <div
                                        style={{
                                            padding: '12px 16px',
                                            borderRadius: isOutgoing ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                            background: isOutgoing
                                                ? 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))'
                                                : 'rgba(30, 41, 59, 0.7)',
                                            color: '#ffffff',
                                            fontSize: '14px',
                                            lineHeight: 1.4,
                                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                                        }}
                                    >
                                        {m.body}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: '10px',
                                            color: 'var(--text-muted)',
                                            marginTop: '4px',
                                            textAlign: isOutgoing ? 'right' : 'left',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: isOutgoing ? 'flex-end' : 'flex-start',
                                            gap: '4px'
                                        }}
                                    >
                                        <span>{formatTime(m.date)}</span>
                                        {isOutgoing && <CheckCheck size={12} color="var(--accent-cyan)" />}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Message Composer Box */}
                    <div
                        style={{
                            padding: '16px 20px',
                            borderTop: '1px solid var(--border-glass)',
                            display: 'flex',
                            gap: '12px',
                            background: 'rgba(15, 23, 42, 0.4)'
                        }}
                    >
                        <input
                            type="text"
                            className="input-glass"
                            placeholder={`Send SMS to ${activeThread.contactName}...`}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <button className="btn-primary" onClick={handleSendMessage} style={{ padding: '10px 18px' }}>
                            <Send size={16} />
                            <span>Send</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="glass-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Select a conversation to view messages</div>
                </div>
            )}
        </div>
    );
}
