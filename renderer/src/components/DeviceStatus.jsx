import React from 'react';
import { Smartphone, BatteryCharging, Battery, Wifi, Bluetooth, Signal } from 'lucide-react';

export default function DeviceStatus({ device }) {
    const getStatusText = () => {
        if (!device.connected) return 'Disconnected';
        if (device.bluetooth) return 'Connected via Wi-Fi & Bluetooth';
        return 'Connected via Wi-Fi';
    };

    return (
        <header
            style={{
                height: '60px',
                padding: '0 24px',
                borderBottom: '1px solid var(--border-glass)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(15, 23, 42, 0.4)'
            }}
        >
            {/* Connected Device Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                    style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(56, 189, 248, 0.1)',
                        border: '1px solid var(--border-glow)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-cyan)'
                    }}
                >
                    <Smartphone size={20} />
                </div>

                <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{device.name}</div>
                    <div className="status-pill" style={{ marginTop: '2px' }}>
                        <span className={`status-dot ${!device.connected ? 'disconnected' : ''}`} />
                        <span style={{ fontSize: '11px', color: device.connected ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                            {getStatusText()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Battery, Signal, Connectivity Status Icons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                {/* Battery Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {device.isCharging ? <BatteryCharging size={18} color="var(--accent-emerald)" /> : <Battery size={18} />}
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{device.battery || 0}%</span>
                </div>

                {/* Cellular Signal & Dynamic Network Type (4G / 5G / LTE) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                    <Signal size={18} color={device.connected && device.signal > 0 ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {device.connected ? (device.networkType || '4G') : 'Offline'}
                    </span>
                </div>

                {/* Wi-Fi & Bluetooth Active Pills */}
                <div style={{ display: 'flex', gap: '6px' }}>
                    <div
                        title={device.connected ? 'Connected over Wi-Fi' : 'Wi-Fi Disconnected'}
                        style={{
                            padding: '6px',
                            borderRadius: 'var(--radius-sm)',
                            background: device.connected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            color: device.connected ? 'var(--accent-cyan)' : 'var(--text-muted)'
                        }}
                    >
                        <Wifi size={16} />
                    </div>
                    <div
                        title={device.bluetooth ? 'Bluetooth Link Connected (RFCOMM)' : 'Bluetooth Link Standby'}
                        style={{
                            padding: '6px',
                            borderRadius: 'var(--radius-sm)',
                            background: device.bluetooth ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            color: device.bluetooth ? 'var(--accent-violet)' : 'var(--text-muted)'
                        }}
                    >
                        <Bluetooth size={16} />
                    </div>
                </div>
            </div>
        </header>
    );
}
