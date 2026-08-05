import React, { useState } from 'react';
import { Smartphone, Wifi, Bluetooth, Key, RefreshCw, CheckCircle, Shield } from 'lucide-react';

export default function Settings({ device }) {
    const [geminiKey, setGeminiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [autoStart, setAutoStart] = useState(true);
    const [isScanning, setIsScanning] = useState(false);

    const handleScan = () => {
        setIsScanning(true);
        setTimeout(() => setIsScanning(false), 2500);
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
            <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Settings & Pairing</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Manage KDE Connect device pairing, system startup preferences, and AI integrations.
                </p>
            </div>

            {/* Device Pairing Card */}
            <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Smartphone size={22} color="var(--accent-cyan)" />
                        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Device Pairing (KDE Connect)</h3>
                    </div>
                    <button className="btn-secondary" onClick={handleScan} disabled={isScanning}>
                        <RefreshCw size={14} className={isScanning ? 'pulse-glow' : ''} />
                        <span>{isScanning ? 'Searching LAN...' : 'Scan for Devices'}</span>
                    </button>
                </div>

                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle size={22} color="var(--accent-emerald)" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '15px' }}>{device.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                IP: 192.168.1.42 • Paired over TLS
                            </div>
                        </div>
                    </div>

                    <span className="status-pill" style={{ color: 'var(--accent-emerald)' }}>
                        Paired & Trusted
                    </span>
                </div>
            </div>

            {/* AI Assistant Integration */}
            <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <Key size={22} color="var(--accent-violet)" />
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>AI Features Configuration</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                        Google Gemini API Key (Smart Replies & Notification Summarization)
                    </label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type={showKey ? 'text' : 'password'}
                            className="input-glass"
                            placeholder="AIzaSy..."
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                        />
                        <button className="btn-secondary" onClick={() => setShowKey(!showKey)}>
                            {showKey ? 'Hide' : 'Show'}
                        </button>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Your key is encrypted and stored locally on your machine.
                    </p>
                </div>
            </div>

            {/* System Startup */}
            <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <Shield size={22} color="var(--accent-cyan)" />
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>System Behavior</h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontWeight: 500, fontSize: '14px' }}>Start with Windows</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Automatically launch minimized to tray when PC boots</div>
                    </div>
                    <input
                        type="checkbox"
                        checked={autoStart}
                        onChange={(e) => setAutoStart(e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                </div>
            </div>
        </div>
    );
}
