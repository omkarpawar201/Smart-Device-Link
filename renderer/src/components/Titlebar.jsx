import React from 'react';
import { Smartphone, Minus, Square, X } from 'lucide-react';

export default function Titlebar() {
    const handleMinimize = () => window.api?.minimizeWindow();
    const handleMaximize = () => window.api?.maximizeWindow();
    const handleClose = () => window.api?.closeWindow();

    return (
        <div
            style={{
                height: '36px',
                background: 'rgba(15, 23, 42, 0.95)',
                borderBottom: '1px solid var(--border-glass)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingLeft: '12px',
                WebkitAppRegion: 'drag',
                zIndex: 1000
            }}
        >
            {/* Brand Logo & Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)' }}>
                <Smartphone size={16} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.3px' }}>
                    Smart Device Link
                </span>
            </div>

            {/* Window Controls */}
            <div style={{ display: 'flex', height: '100%', WebkitAppRegion: 'no-drag' }}>
                <button
                    onClick={handleMinimize}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        width: '44px',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                    <Minus size={14} />
                </button>
                <button
                    onClick={handleMaximize}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        width: '44px',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                    <Square size={12} />
                </button>
                <button
                    onClick={handleClose}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        width: '44px',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#e11d48';
                        e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}
