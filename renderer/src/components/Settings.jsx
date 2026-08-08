import React, { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, CheckCircle, Shield, Key, Wifi, AlertCircle } from 'lucide-react';

export default function Settings({ device }) {
    const [discoveredDevices, setDiscoveredDevices] = useState([]);
    const [pairingRequest, setPairingRequest] = useState(null);
    const [geminiKey, setGeminiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [autoStart, setAutoStart] = useState(true);
    const [isScanning, setIsScanning] = useState(false);

    const fetchDiscovered = () => {
        setIsScanning(true);
        if (window.api && window.api.invoke) {
            window.api.invoke('get-discovered-devices')
                .then((list) => {
                    if (list) setDiscoveredDevices(list);
                })
                .catch((err) => {
                    console.error('Failed to fetch discovered devices:', err);
                })
                .finally(() => {
                    setIsScanning(false);
                });
        } else {
            setTimeout(() => setIsScanning(false), 1500);
        }
    };

    useEffect(() => {
        fetchDiscovered();

        if (window.api && window.api.onDiscoveredDevicesChanged) {
            window.api.onDiscoveredDevicesChanged((list) => {
                setDiscoveredDevices(list);
            });
        }

        if (window.api && window.api.onPairingRequested) {
            window.api.onPairingRequested(({ device, requestId }) => {
                setPairingRequest({ device, requestId });
            });
        }
    }, []);

    const handlePair = (deviceId) => {
        if (window.api && window.api.invoke) {
            window.api.invoke('pair-device', deviceId);
        }
    };

    const handleAcceptPair = () => {
        if (pairingRequest && window.api && window.api.invoke) {
            window.api.invoke('accept-pair', pairingRequest.device.id);
        }
        setPairingRequest(null);
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '850px' }}>
            <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Settings & Device Pairing</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Discover KDE Connect devices on your local Wi-Fi network and manage integration preferences.
                </p>
            </div>

            {/* Incoming Pairing Prompt Card */}
            {pairingRequest && (
                <div
                    className="glass-panel animate-fade-in"
                    style={{
                        padding: '20px 24px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        borderColor: 'var(--border-glow)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <AlertCircle size={24} color="var(--accent-cyan)" />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '15px' }}>Pairing Request from {pairingRequest.device.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                IP: {pairingRequest.device.ip} • Do you trust this device?
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn-primary" onClick={handleAcceptPair} style={{ padding: '8px 16px' }}>
                            Accept Pairing
                        </button>
                        <button className="btn-secondary" onClick={() => setPairingRequest(null)} style={{ padding: '8px 16px' }}>
                            Reject
                        </button>
                    </div>
                </div>
            )}

            {/* Device Pairing Card */}
            <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Smartphone size={22} color="var(--accent-cyan)" />
                        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Discovered LAN Devices (UDP 1716)</h3>
                    </div>
                    <button className="btn-secondary" onClick={fetchDiscovered} disabled={isScanning}>
                        <RefreshCw size={14} className={isScanning ? 'pulse-glow' : ''} />
                        <span>{isScanning ? 'Searching LAN...' : 'Scan for Devices'}</span>
                    </button>
                </div>

                {/* Devices List */}
                {discoveredDevices.length === 0 ? (
                    <div
                        className="glass-card"
                        style={{
                            padding: '24px',
                            textAlign: 'center',
                            color: 'var(--text-secondary)',
                            fontSize: '13px'
                        }}
                    >
                        <div>No new devices discovered on your Wi-Fi network yet.</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Ensure KDE Connect app is open on your Android phone and connected to the same Wi-Fi.
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {discoveredDevices.map((dev) => (
                            <div
                                key={dev.id}
                                className="glass-card"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            background: 'rgba(56, 189, 248, 0.15)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'var(--accent-cyan)'
                                        }}
                                    >
                                        <Smartphone size={20} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '15px' }}>{dev.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                            IP: {dev.ip} • Port: {dev.port}
                                        </div>
                                    </div>
                                </div>

                                <button className="btn-primary" onClick={() => handlePair(dev.id)} style={{ padding: '8px 16px', fontSize: '13px' }}>
                                    Pair Device
                                </button>
                            </div>
                        ))}
                    </div>
                )}
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
