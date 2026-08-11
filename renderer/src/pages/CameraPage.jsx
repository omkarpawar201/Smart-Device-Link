import React, { useState } from 'react';
import { Camera, CameraOff, Circle, Image as ImageIcon, RefreshCcw, Timer, Video, Zap, ZapOff } from 'lucide-react';
import { Button, EmptyState, Panel, SectionTitle, StatusBadge, Tabs } from '../ui-kit';
import { useApp } from '../appStore';

export default function CameraPage() {
    const { toast, deviceName } = useApp();
    const [available, setAvailable] = useState(true);
    const [lens, setLens] = useState('rear');
    const [mode, setMode] = useState('photo');
    const [flash, setFlash] = useState(false);
    const [timer, setTimer] = useState(0);
    const [resolution, setResolution] = useState('4000 × 3000');
    const [shots, setShots] = useState([]);

    if (!available) {
        return (
            <div className="flex h-full items-center justify-center">
                <EmptyState
                    icon={CameraOff}
                    tone="warning"
                    title="Camera permission required"
                    description={`LinkBridge needs camera access on ${deviceName}. Open the companion app on your phone and allow remote camera control.`}
                    action={
                        <>
                            <Button variant="primary" onClick={() => { setAvailable(true); toast({ title: 'Camera connected' }); }}>Retry connection</Button>
                            <Button variant="subtle" onClick={() => toast({ title: 'Request sent to phone' })}>Request permission</Button>
                        </>
                    }
                />
            </div>
        );
    }

    const capture = () => {
        const seed = Date.now();
        setShots((s) => [seed, ...s].slice(0, 6));
        toast({ title: mode === 'photo' ? 'Photo captured' : 'Recording saved', description: 'Saved to DCIM and mirrored to this PC.' });
    };

    return (
        <div className="flex h-full">
            <div className="flex min-w-0 flex-1 flex-col p-5">
                <div className="mb-3 flex items-center gap-3">
                    <div>
                        <h2 className="text-[16px] font-semibold tracking-tight">Phone Camera</h2>
                        <p className="text-[12.5px] text-muted-foreground">{deviceName} · {lens === 'rear' ? '48 MP main' : '16 MP front'} · {resolution}</p>
                    </div>
                    <StatusBadge tone="success" className="ml-2">Camera connected</StatusBadge>
                    <Button variant="ghost" className="ml-auto" onClick={() => setAvailable(false)}>Disconnect camera</Button>
                </div>

                <Panel className="relative flex flex-1 items-center justify-center overflow-hidden bg-[oklch(0.18_0.015_250)] p-0">
                    <div
                        className="absolute inset-0"
                        style={{
                            background: lens === 'rear'
                                ? 'radial-gradient(120% 120% at 30% 20%, oklch(0.32_0.08_250) 0%, oklch(0.22_0.05_230) 45%, oklch(0.14_0.02_220) 100%)'
                                : 'radial-gradient(120% 120% at 70% 30%, oklch(0.30_0.06_200) 0%, oklch(0.20_0.04_250) 55%, oklch(0.13_0.02_260) 100%)'
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.15_0.02_250_/_0.55)] via-transparent to-[oklch(0.15_0.02_250_/_0.35)]" />
                    <div className="absolute inset-6 rounded-lg border border-white/25" />
                    <div className="absolute left-4 top-4 flex gap-2">
                        <span className="rounded-md bg-black/45 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">{lens === 'rear' ? 'REAR' : 'FRONT'}</span>
                        <span className="rounded-md bg-black/45 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">{mode.toUpperCase()}</span>
                        {flash && <span className="rounded-md bg-warning px-2 py-1 text-[11px] font-medium text-warning-foreground">FLASH</span>}
                        {timer > 0 && <span className="rounded-md bg-black/45 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">{timer}s</span>}
                    </div>
                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-5">
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/60" onClick={() => setLens(lens === 'rear' ? 'front' : 'rear')} aria-label="Flip camera">
                            <RefreshCcw className="h-4 w-4" />
                        </Button>
                        <button
                            onClick={capture}
                            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/80 bg-white/20 backdrop-blur transition-transform active:scale-95"
                            aria-label="Capture"
                        >
                            <Circle className={`h-9 w-9 ${mode === 'video' ? 'fill-destructive text-destructive' : 'fill-white text-white'}`} />
                        </button>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/60" onClick={() => setFlash((f) => !f)} aria-label="Flash">
                            {flash ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
                        </Button>
                    </div>
                </Panel>
            </div>

            <aside className="hidden w-[262px] shrink-0 border-l border-border bg-surface p-4 lg:block">
                <SectionTitle title="Capture settings" />
                <div className="space-y-3">
                    <div>
                        <div className="mb-1.5 text-[12px] text-muted-foreground">Lens</div>
                        <Tabs value={lens} onChange={setLens} tabs={[{ key: 'rear', label: 'Rear' }, { key: 'front', label: 'Front' }]} className="w-full" />
                    </div>
                    <div>
                        <div className="mb-1.5 text-[12px] text-muted-foreground">Mode</div>
                        <Tabs value={mode} onChange={setMode} tabs={[{ key: 'photo', label: 'Photo' }, { key: 'video', label: 'Video' }]} className="w-full" />
                    </div>
                    <div>
                        <div className="mb-1.5 text-[12px] text-muted-foreground">Timer</div>
                        <div className="flex gap-1.5">
                            {[0, 3, 5, 10].map((t) => (
                                <Button key={t} size="sm" variant={timer === t ? 'primary' : 'subtle'} onClick={() => setTimer(t)}>
                                    {t === 0 ? 'Off' : `${t}s`}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <div className="mb-1.5 text-[12px] text-muted-foreground">Resolution</div>
                        <select
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value)}
                            className="h-8 w-full rounded-md border border-border bg-surface-2 px-2 text-[12.5px] outline-none focus:border-primary"
                        >
                            <option>4000 × 3000</option>
                            <option>1920 × 1080</option>
                            <option>1280 × 720</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-2 text-[12px] text-muted-foreground">
                        <Timer className="h-3.5 w-3.5" /> Shutter latency ~180 ms over Wi-Fi
                    </div>
                </div>

                <SectionTitle className="mt-5" title="Recent captures" />
                {shots.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted-foreground">
                        <Camera className="mx-auto mb-1.5 h-4 w-4" />
                        Captures appear here
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-1.5">
                        {shots.map((s) => (
                            <div
                                key={s}
                                className="aspect-square rounded-md border border-border object-cover"
                                style={{
                                    background: `linear-gradient(135deg, hsl(${(s % 360) + 200} 45% 32%), hsl(${s % 360} 55% 22%))`
                                }}
                            />
                        ))}
                    </div>
                )}
                <div className="mt-3 flex gap-2 text-[11.5px] text-muted-foreground">
                    <ImageIcon className="h-3.5 w-3.5" /> Photos · <Video className="h-3.5 w-3.5" /> Videos saved to DCIM
                </div>
            </aside>
        </div>
    );
}
