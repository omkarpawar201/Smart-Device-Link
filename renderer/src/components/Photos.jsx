import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import refreshIcon from './icons/refresh_icon.gif';

export default function Photos({ device }) {
    const [photos, setPhotos] = useState([]);
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [isScanning, setIsScanning] = useState(false);

    const fetchPhotos = () => {
        setIsScanning(true);
        if (window.api && typeof window.api.invoke === 'function') {
            const res = window.api.invoke('get-photos');
            if (res && typeof res.then === 'function') {
                res.then((list) => {
                    if (Array.isArray(list)) setPhotos(list);
                })
                    .catch((err) => console.error(err))
                    .finally(() => setTimeout(() => setIsScanning(false), 750));
            }
        }
        if (window.api && window.api.send) {
            window.api.send('scan-photos');
        }
    };

    useEffect(() => {
        fetchPhotos();

        if (window.api && window.api.onPhotosUpdated) {
            window.api.onPhotosUpdated((newPhotos) => {
                if (Array.isArray(newPhotos)) setPhotos(newPhotos);
            });
        }
    }, []);

    const handleDownload = (photo) => {
        if (window.api && window.api.send) {
            window.api.send('download-file', { remotePath: photo.path, name: photo.name });
        }
    };

    const formatDate = (ts) => {
        if (!ts) return '';
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

                <button className="btn-secondary" onClick={fetchPhotos} disabled={isScanning} style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <img src={refreshIcon} alt="Refresh" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                    <span>{isScanning ? 'Scanning DCIM...' : 'Refresh Photos'}</span>
                </button>
            </div>

            {/* Photos Grid */}
            {photos.length === 0 ? (
                <div className="glass-panel" style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {isScanning ? 'Scanning your phone camera roll via SFTP...' : 'No photos loaded yet. Tap "Refresh Photos" or ensure SFTP plugin is allowed on your phone.'}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                    {photos.map((photo) => (
                        <div
                            key={photo.id || photo.name}
                            className="glass-card animate-fade-in"
                            style={{
                                padding: 0,
                                overflow: 'hidden',
                                position: 'relative',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer'
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
                                    display: 'block'
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
                                    opacity: 0.9
                                }}
                            >
                                <div style={{ minWidth: 0, paddingRight: '8px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {photo.name}
                                    </div>
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
                                    style={{ padding: '6px 10px', fontSize: '11px', flexShrink: 0 }}
                                    title="Download to PC Downloads folder"
                                >
                                    <Download size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

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
