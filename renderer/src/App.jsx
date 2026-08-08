import React, { useState, useEffect } from 'react';
import Titlebar from './components/Titlebar';
import Sidebar from './components/Sidebar';
import DeviceStatus from './components/DeviceStatus';
import ViewContainer from './components/ViewContainer';

export default function App() {
    const [activeTab, setActiveTab] = useState('notifications');

    const [deviceState, setDeviceState] = useState({
        name: 'No Device Connected',
        connected: false,
        battery: 0,
        isCharging: false,
        signal: 0,
        networkType: 'Offline',
        wifi: false,
        bluetooth: false
    });

    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        // Device status listener
        if (window.api && window.api.onDeviceStatusChanged) {
            window.api.onDeviceStatusChanged((newStatus) => {
                setDeviceState((prev) => ({ ...prev, ...newStatus }));
            });
        }

        // Notification IPC sync & listeners
        if (window.api && typeof window.api.invoke === 'function') {
            const res = window.api.invoke('get-notifications');
            if (res && typeof res.then === 'function') {
                res.then((list) => {
                    if (Array.isArray(list)) setNotifications(list);
                }).catch((err) => console.error(err));
            }
        }

        if (window.api && window.api.onNotificationReceived) {
            window.api.onNotificationReceived((newNotif) => {
                setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
            });
        }

        if (window.api && window.api.onNotificationDismissed) {
            window.api.onNotificationDismissed(({ id }) => {
                setNotifications((prev) => prev.filter((n) => n.id !== id));
            });
        }
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
            <Titlebar />

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
                <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} notificationCount={notifications.length} />

                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg-dark)' }}>
                    <DeviceStatus device={deviceState} />

                    <main style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                        <ViewContainer
                            activeTab={activeTab}
                            device={deviceState}
                            notifications={notifications}
                            setNotifications={setNotifications}
                        />
                    </main>
                </div>
            </div>
        </div>
    );
}
