import React, { useState } from 'react';
import {
    Folder,
    FileText,
    Image as ImageIcon,
    Film,
    Music,
    Archive,
    Download,
    Trash2,
    ChevronRight,
    Search,
    Grid,
    List,
    HardDrive,
    UploadCloud
} from 'lucide-react';

export default function Files({ device }) {
    const [currentPath, setCurrentPath] = useState('/sdcard');
    const [viewMode, setViewMode] = useState('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const [files, setFiles] = useState([
        { name: 'DCIM', isDir: true, size: 0, path: '/sdcard/DCIM' },
        { name: 'Download', isDir: true, size: 0, path: '/sdcard/Download' },
        { name: 'Documents', isDir: true, size: 0, path: '/sdcard/Documents' },
        { name: 'Pictures', isDir: true, size: 0, path: '/sdcard/Pictures' },
        { name: 'Music', isDir: true, size: 0, path: '/sdcard/Music' },
        { name: 'project_presentation.pdf', isDir: false, size: 4500000, path: '/sdcard/project_presentation.pdf' },
        { name: 'vacation_photo.jpg', isDir: false, size: 2800000, path: '/sdcard/vacation_photo.jpg' },
        { name: 'backup_archive.zip', isDir: false, size: 18400000, path: '/sdcard/backup_archive.zip' }
    ]);

    const handleNavigate = (newPath) => {
        setCurrentPath(newPath);
        if (window.api && window.api.invoke) {
            window.api.invoke('fetch-files', { path: newPath }).then((items) => {
                if (items) setFiles(items);
            });
        }
    };

    const handleDownload = (file) => {
        if (window.api && window.api.send) {
            window.api.send('download-file', { remotePath: file.path, name: file.name });
        }
    };

    const handleDelete = (file) => {
        setFiles((prev) => prev.filter((f) => f.path !== file.path));
        if (window.api && window.api.send) {
            window.api.send('delete-file', { remotePath: file.path, isDir: file.isDir });
        }
    };

    // Drag and Drop Upload Handlers
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);

        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length === 0) return;

        setIsUploading(true);
        setUploadProgress(20);

        droppedFiles.forEach((file, index) => {
            const newFileObj = {
                name: file.name,
                isDir: false,
                size: file.size,
                path: `${currentPath}/${file.name}`
            };

            setFiles((prev) => [newFileObj, ...prev]);

            if (window.api && window.api.send) {
                window.api.send('upload-file', {
                    localPath: file.path,
                    remoteDirectory: currentPath
                });
            }

            setUploadProgress(Math.floor(((index + 1) / droppedFiles.length) * 100));
        });

        setTimeout(() => {
            setIsUploading(false);
            setUploadProgress(0);
        }, 1500);
    };

    const formatSize = (bytes) => {
        if (!bytes || bytes === 0) return '--';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getFileIcon = (file) => {
        if (file.isDir) return <Folder size={22} color="var(--accent-amber)" />;
        const ext = file.name.split('.').pop().toLowerCase();
        if (['jpg', 'png', 'gif', 'jpeg'].includes(ext)) return <ImageIcon size={20} color="var(--accent-cyan)" />;
        if (['mp4', 'mkv', 'avi'].includes(ext)) return <Film size={20} color="var(--accent-rose)" />;
        if (['mp3', 'wav', 'flac'].includes(ext)) return <Music size={20} color="var(--accent-violet)" />;
        if (['zip', 'rar', '7z', 'tar'].includes(ext)) return <Archive size={20} color="var(--accent-amber)" />;
        return <FileText size={20} color="var(--text-secondary)" />;
    };

    const pathParts = currentPath.split('/').filter(Boolean);
    const filteredFiles = files.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div
            className="animate-fade-in"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                maxWidth: '1100px',
                position: 'relative',
                minHeight: '450px'
            }}
        >
            {/* Drag & Drop Visual Overlay */}
            {isDraggingOver && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 50,
                        background: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(16px)',
                        border: '2px dashed var(--accent-cyan)',
                        borderRadius: 'var(--radius-lg)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '14px',
                        color: 'var(--accent-cyan)'
                    }}
                >
                    <UploadCloud size={64} className="pulse-glow" />
                    <div style={{ fontSize: '20px', fontWeight: 700 }}>Drop files to upload to {currentPath}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Files will be transferred via SFTP</div>
                </div>
            )}

            {/* Uploading Progress Toast */}
            {isUploading && (
                <div
                    className="glass-panel animate-fade-in"
                    style={{
                        padding: '14px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        borderColor: 'var(--border-glow)'
                    }}
                >
                    <UploadCloud size={20} color="var(--accent-cyan)" />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>Uploading to Phone ({uploadProgress}%)</div>
                        <div
                            style={{
                                width: '100%',
                                height: '4px',
                                background: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '999px',
                                marginTop: '6px',
                                overflow: 'hidden'
                            }}
                        >
                            <div
                                style={{
                                    width: `${uploadProgress}%`,
                                    height: '100%',
                                    background: 'var(--accent-cyan)',
                                    transition: 'width 0.2s ease'
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Header Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>File Manager</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Browse and manage storage on {device?.name || 'your phone'}. Drag & drop files anywhere to upload.
                    </p>
                </div>

                {/* View Mode Toggles */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        className="btn-secondary"
                        onClick={() => setViewMode('grid')}
                        style={{
                            padding: '8px',
                            background: viewMode === 'grid' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                            color: viewMode === 'grid' ? 'var(--accent-cyan)' : 'var(--text-secondary)'
                        }}
                    >
                        <Grid size={16} />
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={() => setViewMode('list')}
                        style={{
                            padding: '8px',
                            background: viewMode === 'list' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                            color: viewMode === 'list' ? 'var(--accent-cyan)' : 'var(--text-secondary)'
                        }}
                    >
                        <List size={16} />
                    </button>
                </div>
            </div>

            {/* Path Breadcrumb Bar & Search */}
            <div
                className="glass-panel"
                style={{
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px'
                }}
            >
                {/* Breadcrumbs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500 }}>
                    <HardDrive size={16} color="var(--accent-cyan)" />
                    <span onClick={() => handleNavigate('/sdcard')} style={{ cursor: 'pointer', color: 'var(--accent-cyan)' }}>
                        Internal Storage
                    </span>
                    {pathParts.map((part, index) => {
                        const subPath = '/' + pathParts.slice(0, index + 1).join('/');
                        return (
                            <React.Fragment key={subPath}>
                                <ChevronRight size={14} color="var(--text-muted)" />
                                <span
                                    onClick={() => handleNavigate(subPath)}
                                    style={{
                                        cursor: 'pointer',
                                        color: index === pathParts.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        fontWeight: index === pathParts.length - 1 ? 600 : 400
                                    }}
                                >
                                    {part}
                                </span>
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Search Input */}
                <div style={{ position: 'relative', width: '240px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        className="input-glass"
                        placeholder="Search files..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ paddingLeft: '32px', fontSize: '12px', padding: '6px 10px 6px 32px' }}
                    />
                </div>
            </div>

            {/* Files Grid or List View */}
            {viewMode === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
                    {filteredFiles.map((file) => (
                        <div
                            key={file.path}
                            className="glass-card animate-fade-in"
                            onDoubleClick={() => file.isDir && handleNavigate(file.path)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                textAlign: 'center',
                                padding: '20px 14px',
                                gap: '10px',
                                cursor: file.isDir ? 'pointer' : 'default',
                                position: 'relative'
                            }}
                        >
                            {getFileIcon(file)}

                            <div style={{ width: '100%' }}>
                                <div
                                    style={{
                                        fontWeight: 600,
                                        fontSize: '13px',
                                        color: 'var(--text-primary)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}
                                >
                                    {file.name}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {file.isDir ? 'Folder' : formatSize(file.size)}
                                </div>
                            </div>

                            {!file.isDir && (
                                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                    <button
                                        className="btn-secondary"
                                        onClick={() => handleDownload(file)}
                                        style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }}
                                        title="Download to PC"
                                    >
                                        <Download size={13} color="var(--accent-cyan)" />
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        onClick={() => handleDelete(file)}
                                        style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }}
                                        title="Delete"
                                    >
                                        <Trash2 size={13} color="var(--accent-rose)" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                /* List View */
                <div className="glass-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {filteredFiles.map((file) => (
                        <div
                            key={file.path}
                            onDoubleClick={() => file.isDir && handleNavigate(file.path)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 16px',
                                borderRadius: 'var(--radius-md)',
                                background: 'rgba(255, 255, 255, 0.02)',
                                cursor: file.isDir ? 'pointer' : 'default'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {getFileIcon(file)}
                                <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-primary)' }}>{file.name}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '80px', textAlign: 'right' }}>
                                    {file.isDir ? 'Folder' : formatSize(file.size)}
                                </span>
                                {!file.isDir && (
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button className="btn-secondary" onClick={() => handleDownload(file)} style={{ padding: '6px' }}>
                                            <Download size={13} />
                                        </button>
                                        <button className="btn-secondary" onClick={() => handleDelete(file)} style={{ padding: '6px' }}>
                                            <Trash2 size={13} color="var(--accent-rose)" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
