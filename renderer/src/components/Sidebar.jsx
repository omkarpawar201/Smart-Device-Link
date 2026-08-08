import React from 'react';
import {
    Bell,
    MessageSquare,
    PhoneCall,
    Users,
    Image,
    Folder,
    Monitor,
    Clipboard,
    Camera,
    Music,
    Bot,
    Settings
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, notificationCount }) {
    const menuItems = [
        { id: 'notifications', label: 'Notifications', icon: Bell, badge: notificationCount > 0 ? notificationCount : null },
        { id: 'messages', label: 'Messages', icon: MessageSquare },
        { id: 'calls', label: 'Phone Calls', icon: PhoneCall },
        { id: 'contacts', label: 'Contacts', icon: Users },
        { id: 'photos', label: 'Photos', icon: Image },
        { id: 'files', label: 'File Manager', icon: Folder },
        { id: 'screen', label: 'Screen Mirror', icon: Monitor },
        { id: 'clipboard', label: 'Shared Clipboard', icon: Clipboard },
        { id: 'camera', label: 'Phone Camera', icon: Camera },
        { id: 'media', label: 'Media Controls', icon: Music },
        { id: 'ai', label: 'AI Assistant', icon: Bot, highlight: true },
        { id: 'settings', label: 'Settings', icon: Settings }
    ];


    return (
        <aside
            className="glass-panel"
            style={{
                width: '240px',
                margin: '12px 0 12px 12px',
                display: 'flex',
                flexDirection: 'column',
                padding: '12px 8px',
                gap: '4px'
            }}
        >
            <div style={{ padding: '8px 12px 14px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '1px' }}>
                FEATURES
            </div>

            {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-md)',
                            border: isActive ? '1px solid var(--border-glow)' : '1px solid transparent',
                            background: isActive
                                ? 'linear-gradient(90deg, rgba(56, 189, 248, 0.18), rgba(30, 41, 59, 0.4))'
                                : 'transparent',
                            color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: isActive ? 600 : 500,
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            if (!isActive) {
                                e.currentTarget.style.background = 'var(--bg-glass-hover)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isActive) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                            }
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Icon size={18} color={item.highlight ? 'var(--accent-violet)' : undefined} />
                            <span>{item.label}</span>
                        </div>

                        {item.badge && (
                            <span
                                style={{
                                    background: 'var(--accent-cyan)',
                                    color: '#0f172a',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 7px',
                                    borderRadius: '999px'
                                }}
                            >
                                {item.badge}
                            </span>
                        )}
                    </button>
                );
            })}
        </aside>
    );
}
