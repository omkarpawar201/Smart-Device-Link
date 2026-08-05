import React, { useState, useEffect } from 'react';
import Titlebar from './components/Titlebar';
import Sidebar from './components/Sidebar';
import DeviceStatus from './components/DeviceStatus';
import ViewContainer from './components/ViewContainer';

export default function App() {
    const [activeTab, setActiveTab] = useState('notifications');

    // Simulated initial device state (will be bound to real KDE Connect IPC in Phase 2)
    const [deviceState, setDeviceState] = useState({
        name: 'Galaxy S23 Ultra',
        connected: true,
        battery: 82,
        isCharging: false,
        signal: 4, // 1 to 4 bars
        wifi: true,
        bluetooth: true
    });

    useEffect(() => {
        // Listen for IPC device status updates if window.api is available
        if (window.api && window.api.onDeviceStatusChanged) {
            window.api.onDeviceStatusChanged((newStatus) => {
                setDeviceState((prev) => ({ ...prev, ...newStatus }));
            });
        }
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
            {/* Top Custom Window Title Bar */}
            <Titlebar />

            {/* Main Glassmorphic Application Dashboard */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
                {/* Left Navigation Sidebar */}
                <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

                {/* Content Area */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-dark)' }}>
                    {/* Header Bar with Live Device Status */}
                    <DeviceStatus device={deviceState} />

                    {/* Active Tab View Body */}
                    <main style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                        <ViewContainer activeTab={activeTab} device={deviceState} />
                    </main>
                </div>
            </div>
        </div>
    );
}
