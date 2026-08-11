import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Monitor, Play, RefreshCw, Smartphone, Square } from 'lucide-react';
import { Button, Panel, StatusBadge } from '../ui-kit';
import { useApp } from '../appStore';

export default function ScreenPage() {
    const { deviceName, toast } = useApp();
    const [devices, setDevices] = useState([]);
    const [selectedSerial, setSelectedSerial] = useState('');
    const [bins, setBins] = useState({ scrcpy: null, adb: null });
    const [running, setRunning] = useState(false);
    const [activeSerial, setActiveSerial] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [turnScreenOff, setTurnScreenOff] = useState(false);
    const [stayAwake, setStayAwake] = useState(true);
    const [maxFps, setMaxFps] = useState(30);

    const runningRef = useRef(false);
    const selectedSerialRef = useRef('');

    const refreshDevices = useCallback(async () => {
        setLoading(true);
        try {
            const res = await window.api.invoke('mirror:list-devices');
            if (res && res.ok) {
                setBins({ scrcpy: res.scrcpy, adb: res.adb });
                const list = res.devices || [];
                setDevices(list);
                if (!runningRef.current && !selectedSerialRef.current) {
                    const online = list.filter((d) => d.state === 'device');
                    const tcp = online.find((d) => d.isTcpip) || online[0];
                    if (tcp) {
                        setSelectedSerial(tcp.serial);
                        selectedSerialRef.current = tcp.serial;
                    }
                }
            } else {
                setError((res && res.error) || 'Failed to list adb devices');
            }
        } catch (e) {
            setError(e.message || String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshDevices();
        if (window.api && window.api.onMirrorStatus) {
            window.api.onMirrorStatus((status) => {
                runningRef.current = !!status.running;
                setRunning(runningRef.current);
                setActiveSerial(status.serial || null);
                if (status.error) setError(status.error);
            });
        }
    }, [refreshDevices]);

    const start = () => {
        setError('');
        selectedSerialRef.current = selectedSerial;
        window.api.send('mirror:start', { serial: selectedSerial || undefined, turnScreenOff, stayAwake, maxFps });
        toast({ title: 'Starting mirror…' });
    };

    const stop = () => {
        window.api.send('mirror:stop');
    };

    const hasScrcpy = !!bins.scrcpy;
    const onlineDevice = devices.find((d) => d.serial === activeSerial);

    return (
        <div className="lb-scroll h-full p-5">
            <div className="mx-auto max-w-[860px] space-y-4">
                <div className="flex items-center gap-2">
                    <div>
                        <h3 className="text-[16px] font-semibold">Screen Mirroring</h3>
                        <p className="text-[12.5px] text-muted-foreground">
                            Control {deviceName} from the PC — tap, swipe, type, use apps without touching it.
                        </p>
                    </div>
                    <Button className="ml-auto" variant="ghost" onClick={refreshDevices} disabled={loading}>
                        <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
                    </Button>
                </div>

                {!hasScrcpy && (
                    <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        <div className="text-[12.5px] leading-relaxed text-muted-foreground">
                            <b className="text-foreground">scrcpy not found.</b> Install it with{' '}
                            <code className="rounded bg-surface-3 px-1.5 py-0.5 text-[11.5px]">winget install Genymobile.scrcpy</code> and restart the app.
                        </div>
                    </div>
                )}

                <Panel className="space-y-4 p-5">
                    <div>
                        <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-widest text-muted-foreground">Phone (ADB over Wi-Fi)</div>
                        {devices.length === 0 ? (
                            <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                                <Smartphone className="h-4 w-4" />
                                No device connected. Enable <b>Wireless Debugging</b> on the phone, then{' '}
                                <code className="rounded bg-surface-3 px-1.5 py-0.5 text-[11.5px]">adb connect &lt;ip&gt;:&lt;port&gt;</code>
                            </div>
                        ) : (
                            <select
                                value={selectedSerial}
                                onChange={(e) => setSelectedSerial(e.target.value)}
                                disabled={running}
                                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-primary"
                            >
                                {devices.map((d) => (
                                    <option key={d.serial} value={d.serial} disabled={d.state !== 'device'}>
                                        {d.model || d.kind || 'Android device'} — {d.serial} {d.state !== 'device' ? `(${d.state})` : ''}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-[12.5px]">
                        <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                            <input type="checkbox" checked={turnScreenOff} onChange={(e) => setTurnScreenOff(e.target.checked)} disabled={running} />
                            Turn phone screen off while mirroring
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                            <input type="checkbox" checked={stayAwake} onChange={(e) => setStayAwake(e.target.checked)} disabled={running} />
                            Keep phone awake
                        </label>
                        <label className="flex items-center gap-2 text-muted-foreground">
                            Max FPS
                            <select
                                value={maxFps}
                                onChange={(e) => setMaxFps(Number(e.target.value))}
                                disabled={running}
                                className="rounded-md border border-border bg-surface-2 px-2 py-1 text-[12.5px] outline-none focus:border-primary"
                            >
                                <option value={30}>30</option>
                                <option value={60}>60</option>
                            </select>
                        </label>
                    </div>

                    {error && (
                        <div className="whitespace-pre-wrap rounded-md bg-destructive/10 px-3 py-2 text-[12px] leading-relaxed text-destructive">{error}</div>
                    )}

                    <div className="flex items-center gap-3">
                        {running ? (
                            <Button variant="destructive" onClick={stop}><Square className="h-4 w-4" /> Stop Mirroring</Button>
                        ) : (
                            <Button variant="primary" onClick={start} disabled={!hasScrcpy || devices.length === 0}>
                                <Play className="h-4 w-4" /> Start Mirroring
                            </Button>
                        )}
                        {running && <StatusBadge tone="success">Mirroring {onlineDevice?.model || activeSerial}</StatusBadge>}
                    </div>
                </Panel>

                <Panel className="flex items-start gap-3 p-4">
                    <Monitor className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="text-[12.5px] leading-relaxed text-muted-foreground">
                        {running ? (
                            <>
                                <b className="text-foreground"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-success" />Mirror running.</b>{' '}
                                The mirror opens in its own scrcpy window — click = tap, drag = swipe, scroll = scroll, Ctrl+V pastes clipboard.
                            </>
                        ) : (
                            <>This uses <b className="text-foreground">scrcpy</b> over adb Wi-Fi — the same control technology Phone Link-style apps use. Works even when the phone is locked; drive any app remotely once mirrored.</>
                        )}
                    </div>
                </Panel>
            </div>
        </div>
    );
}
