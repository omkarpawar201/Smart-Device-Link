import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Download, Copy, RefreshCw, X, ZoomIn, Calendar, Sparkles } from 'lucide-react';

export default function Photos({ device }) {
    const [photos, setPhotos] = useState([
        {
            id: 'p1',
            name: 'IMG_20260805_143021.jpg',
            path: '/sdcard/DCIM/Camera/IMG_20260805_143021.jpg',
            url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
            date: Date.now() - 1000 * 60 * 60 * 2,
            size: '3.4 MB'
        },
        {
            id: 'p2',
            name: 'IMG_20260804_182010.jpg',
            path: '/sdcard/DCIM/Camera/IMG_20260804_182010.jpg',
            url: 'https://images.unsplash.com/photo-1511884642898-4c92249e20b6?w=800&q=80',
            date: Date.now() - 1000 * 60 * 60 * 24,
            size: '4.1 MB'
        },
        {
            id: 'p3',
            name: 'IMG_20260803_091544.jpg',
            path: '/sdcard/DCIM/Camera/IMG_20260803_091544.jpg',
            url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80',
            date: Date.now() - 1000 * 60 * 60 * 48,
            size: '2.9 MB'
        },
        {
            id: 'p4',
            name: 'IMG_20260802_121000.jpg',
            path: '/sdcard/DCIM/Camera/IMG_20260802_121000.jpg',
            url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
            date: Date.now() - 1000 * 60 * 60 * 72,
            size: '5.2 MB'
        }
    ]);

    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        if (window.api && window.api.onPhotosUpdated) {
            window.api.onPhotosUpdated((newPhotos) => {
                setPhotos(newPhotos);
            });
        }
    }, []);

    const handleRefresh = () => {
        setIsScanning(true);
        if (window.api && window.api.send) {
            window.api.send('scan-photos');
        }
        setTimeout(() => setIsScanning(false), 2000);
    };

    const handleDownload = (photo) => {
        if (window.api && window.api.send) {
            window.api.send('download-file', { remotePath: photo.path, name: photo.name });
        }
    };

    const formatDate = (ts) => {
        return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1100px' }}>
            {/* Header Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Photos & Media</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Instant access to camera photos on {device?.name || 'your phone'}.
                    </p>
                </div>

                <button className="btn-secondary" onClick={handleRefresh} disabled={isScanning}>
                    <RefreshCw size={14} className={isScanning ? 'pulse-glow' : ''} />
                    <span>{isScanning ? 'Scanning DCIM...' : 'Refresh Photos'}</span>
                </button>
            </div>

            {/* Masonry Photo Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                {photos.map((photo) => (
                    <div
                        key={photo.id}
                        className="glass-card animate-fade-in"
                        style={{
                            padding: 0,
                            overflow: 'hidden',
                            position: 'relative',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            group: 'photo-card'
                        }}
                        onClick={() => setSelectedPhoto(photo)}
                    >
                        <img
                            src={photo.url}
                            alt={photo.name}
                            style={{
                                width: '100%',
                                height: '200px',
                                objectFit: 'cover',
                                display: 'block',
                                transition: 'transform 0.3s ease'
                            }}
                        />

                        {/* Hover Action Gradient Overlay */}
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'linear-gradient(to top, rgba(15, 23, 42, 0.85) 0%, transparent 60%)',
                                display: 'flex',
                                alignItems: 'flex-end',
                                justifyContent: 'space-between',
                                padding: '12px 14px',
                                opacity: 0.9,
                                transition: 'opacity 0.2s ease'
                            }}
                        >
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>{photo.name}</div>
                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    {formatDate(photo.date)} • {photo.size}
                                </div>
                            </div>

                            <button
                                className="btn-primary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(photo);
                                }}
                                style={{ padding: '6px 10px', fontSize: '11px' }}
                            >
                                <Download size={12} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Full-Screen Lightbox Preview Modal */}
            {selectedPhoto && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        background: 'rgba(11, 15, 25, 0.92)',
                        backdropFilter: 'blur(20px)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px'
                    }}
                    className="animate-fade-in"
                >
                    {/* Lightbox Toolbar */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '20px',
                            right: '24px',
                            display: 'flex',
                            gap: '12px'
                        }}
                    >
                        <button className="btn-primary" onClick={() => handleDownload(selectedPhoto)}>
                            <Download size={16} />
                            <span>Download to PC</span>
                        </button>
                        <button
                            onClick={() => setSelectedPhoto(null)}
                            style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: 'none',
                                color: '#ffffff',
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Expanded Preview Image */}
                    <img
                        src={selectedPhoto.url}
                        alt={selectedPhoto.name}
                        style={{
                            maxWidth: '85vw',
                            maxHeight: '75vh',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow-lg)',
                            objectFit: 'contain'
                        }}
                    />

                    {/* Photo Info Caption */}
                    <div style={{ textAlign: 'center', marginTop: '16px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedPhoto.name}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Taken on {formatDate(selectedPhoto.date)} • Size: {selectedPhoto.size}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
