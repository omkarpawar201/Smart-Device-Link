import React from 'react';
import Notifications from './Notifications';
import Messages from './Messages';
import Contacts from './Contacts';
import Photos from './Photos';
import Files from './Files';
import ClipboardView from './Clipboard';
import Media from './Media';
import Settings from './Settings';

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
    Bot
} from 'lucide-react';

export default function ViewContainer({ activeTab, device, notifications, setNotifications }) {
    if (activeTab === 'notifications') return <Notifications device={device} notifications={notifications} setNotifications={setNotifications} />;
    if (activeTab === 'messages') return <Messages device={device} />;
    if (activeTab === 'contacts') return <Contacts device={device} />;
    if (activeTab === 'photos') return <Photos device={device} />;
    if (activeTab === 'files') return <Files device={device} />;
    if (activeTab === 'clipboard') return <ClipboardView device={device} />;
    if (activeTab === 'media') return <Media device={device} />;
    if (activeTab === 'settings') return <Settings device={device} />;

    const placeholderTabs = {
        messages: { title: 'SMS Messages', icon: MessageSquare, color: 'var(--accent-blue)', desc: 'Bi-directional SMS/MMS conversation threads & composer' },
        calls: { title: 'Phone Calls', icon: PhoneCall, color: 'var(--accent-emerald)', desc: 'Bluetooth HFP phone calls dialer & real-time audio routing' },
        contacts: { title: 'Contacts', icon: Users, color: 'var(--accent-cyan)', desc: 'Phone contacts directory & quick dial action' },
        photos: { title: 'Photos', icon: Image, color: 'var(--accent-violet)', desc: 'Instant access to recent camera photos & drag to PC' },
        files: { title: 'File Manager', icon: Folder, color: 'var(--accent-amber)', desc: 'SFTP phone storage file browser & transfer manager' },
        screen: { title: 'Screen Mirroring', icon: Monitor, color: 'var(--accent-rose)', desc: 'Low-latency interactive phone screen canvas with mouse/KB control' },
        clipboard: { title: 'Shared Clipboard', icon: Clipboard, color: 'var(--accent-cyan)', desc: 'Automatic cross-device text & image copy-paste sync' },
        camera: { title: 'Phone Camera / Webcam', icon: Camera, color: 'var(--accent-emerald)', desc: 'Use Android phone camera as HD virtual PC webcam' },
        media: { title: 'Media Controls', icon: Music, color: 'var(--accent-violet)', desc: 'MPRIS remote control for phone audio playback' },
        ai: { title: 'AI Assistant', icon: Bot, color: 'var(--accent-violet)', desc: 'Gemini-powered notification summaries, smart replies & OCR' }
    };

    const current = placeholderTabs[activeTab] || placeholderTabs.messages;
    const Icon = current.icon;

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: 'rgba(255, 255, 255, 0.05)', color: current.color }}>
                    <Icon size={24} />
                </div>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{current.title}</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{current.desc}</p>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '340px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: current.color, marginBottom: '16px' }}>
                    <Icon size={32} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>{current.title} Module Ready</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '460px', lineHeight: 1.5 }}>
                    The UI framework and state bridge for {current.title} are connected. Device engine handler will be integrated in Phase 2 & 3.
                </p>
            </div>
        </div>
    );
}
