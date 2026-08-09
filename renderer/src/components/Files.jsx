import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    UploadCloud,
    ArrowUp,
    RefreshCw,
    Loader,
    FolderPlus
} from 'lucide-react';

export default function Files({ device }) {
    const [currentPath, setCurrentPath] = useState('/sdcard');
    const [viewMode, setViewMode] = useState('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const dragCounter = useRef(0);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploads, setUploads] = useState([]);

    const [files, setFiles] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [storageRoots, setStorageRoots] = useState([]);
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [folderName, setFolderName] = useState('');

    const loadDirectory = useCallback((newPath) => {
        setCurrentPath(newPath);
        setIsLoading(true);
        setError('');
        if (window.api && window.api.invoke) {
            window.api
                .invoke('fetch-files', { path: newPath })
                .then((items) => {
                    if (Array.isArray(items)) {
                        setFiles(items);
                        setError('');
                    } else {
                        setError('Could not read this folder.');
                    }
                })
                .catch((err) => {
                    console.error(err);
                    setError('Could not read this folder: ' + (err?.message || 'unknown error'));
                })
                .finally(() => setIsLoading(false));
        } else {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            let initialPath = '/sdcard';
            if (window.api && window.api.invoke) {
                try {
                    const roots = await window.api.invoke('list-storage-roots');
                    if (!cancelled && Array.isArray(roots) && roots.length) {
                        setStorageRoots(roots);
                        const preferred = roots.find((r) => r.id === 'internal') || roots[0];
                        initialPath = preferred.path;
                    }
                } catch (e) {
                    console.error(e);
                }
            }
            if (!cancelled) loadDirectory(initialPath);
        })();
        return () => {
            cancelled = true;
        };
    }, [loadDirectory]);

    const currentRoot = storageRoots.find(
        (r) => currentPath === r.path || currentPath.startsWith(r.path + '/')
    ) || null;

    const handleNavigate = (newPath) => {
        loadDirectory(newPath);
    };

    const handleGoUp = () => {
        if (!currentPath || currentPath === '/') return;
        if (currentRoot && currentPath === currentRoot.path) return;
        const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
        loadDirectory(parent);
    };

    const handleDownload = (file) => {
        if (window.api && window.api.send) {
            window.api.send('download-file', { remotePath: file.path, name: file.name });
        }
    };

    const handleNewFolderSubmit = async (e) => {
        e.preventDefault();
        const safeName = folderName.trim().replace(/[/\\]/g, '_');
        if (!safeName) return;

        if (window.api && window.api.invoke) {
            try {
                const res = await window.api.invoke('create-directory', { path: `${currentPath}/${safeName}` });
                if (res && res.ok) {
                    setCreatingFolder(false);
                    setFolderName('');
                    loadDirectory(currentPath);
                } else {
                    console.error('create-directory failed:', res?.error || 'unknown error');
                }
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleDelete = (file) => {
        setFiles((prev) => prev.filter((f) => f.path !== file.path));
        if (window.api && window.api.send) {
            window.api.send('delete-file', { remotePath: file.path, isDir: file.isDir });
        }
    };

    // Drag and Drop Upload Handlers
    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        setIsDraggingOver(true);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setIsDraggingOver(false);
        }
    };

    useEffect(() => {
        if (!window.api || !window.api.onUploadProgress) return;
        return window.api.onUploadProgress(({ name, progress, done, failed }) => {
            setUploads((prev) => {
                if (!prev.length) return prev;
                return prev.map((u) =>
                    u.name === name ? { ...u, transferred: u.size * progress, done: !!done, failed: !!failed } : u
                );
            });
        });
    }, []);

    useEffect(() => {
        if (!uploads.length) return;
        const totalBytes = uploads.reduce((s, u) => s + u.size, 0);
        const transferredBytes = uploads.reduce((s, u) => s + u.transferred, 0);
        setUploadProgress(totalBytes > 0 ? Math.floor((transferredBytes / totalBytes) * 100) : 0);
        if (uploads.every((u) => u.done)) {
            const timer = setTimeout(() => {
                setIsUploading(false);
                setUploads([]);
                setUploadProgress(0);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [uploads]);

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current = 0;
        setIsDraggingOver(false);

        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length === 0) return;

        const batch = droppedFiles.map((file) => ({
            name: file.name,
            size: file.size || 0,
            transferred: 0,
            done: false
        }));
        setUploads(batch);
        setIsUploading(true);
        setUploadProgress(0);

        droppedFiles.forEach((file) => {
            const localPath = window.api && window.api.getPathForFile ? window.api.getPathForFile(file) : file.path || '';

            const newFileObj = {
                name: file.name,
                isDir: false,
                size: file.size,
                path: `${currentPath}/${file.name}`
            };

            setFiles((prev) => [newFileObj, ...prev]);

            if (localPath && window.api && window.api.send) {
                window.api.send('upload-file', {
                    localPath,
                    remoteDirectory: currentPath
                });
            }
        });
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
    const rootParts = (currentRoot?.path || '').split('/').filter(Boolean);
    const crumbParts =
        rootParts.length && (currentPath === currentRoot.path || currentPath.startsWith(currentRoot.path + '/'))
            ? pathParts.slice(rootParts.length)
            : pathParts;
    const filteredFiles = files.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div
            className="animate-fade-in"
            onDragEnter={handleDragEnter}
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
                        pointerEvents: 'none',
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
                        {uploads.map((u) => {
                            const pct = u.size > 0 ? Math.floor((u.transferred / u.size) * 100) : u.done ? 100 : 0;
                            return (
                                <div key={u.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                                    <span style={{ fontSize: '12px', color: u.failed ? 'var(--accent-rose)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>
                                        {u.name}
                                    </span>
                                    <div
                                        style={{
                                            flex: 1,
                                            height: '3px',
                                            background: 'rgba(255, 255, 255, 0.1)',
                                            borderRadius: '999px',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: `${pct}%`,
                                                height: '100%',
                                                background: u.failed ? 'var(--accent-rose)' : u.done ? 'var(--accent-green, #34d399)' : 'var(--accent-cyan)',
                                                transition: 'width 0.2s ease'
                                            }}
                                        />
                                    </div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '40px', textAlign: 'right' }}>
                                        {u.failed ? 'Failed' : u.done ? 'Done' : `${pct}%`}
                                    </span>
                                </div>
                            );
                        })}
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
                    {creatingFolder ? (
                        <form
                            onSubmit={handleNewFolderSubmit}
                            style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
                        >
                            <input
                                className="input-glass"
                                autoFocus
                                value={folderName}
                                onChange={(e) => setFolderName(e.target.value)}
                                placeholder="Folder name"
                                style={{ fontSize: '12px', padding: '6px 10px', width: '160px' }}
                            />
                            <button type="submit" className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                                Create
                            </button>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                    setCreatingFolder(false);
                                    setFolderName('');
                                }}
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                            >
                                Cancel
                            </button>
                        </form>
                    ) : (
                        <button
                            className="btn-secondary"
                            onClick={() => {
                                setCreatingFolder(true);
                                setFolderName('');
                            }}
                            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                            title="Create a new folder here"
                        >
                            <FolderPlus size={15} color="var(--accent-amber)" />
                            <span>New Folder</span>
                        </button>
                    )}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500 }}>
                    <button
                        className="btn-secondary"
                        onClick={handleGoUp}
                        title="Go up one folder"
                        style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }}
                    >
                        <ArrowUp size={15} color="var(--text-secondary)" />
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={() => loadDirectory(currentPath)}
                        title="Refresh current folder"
                        style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }}
                    >
                        <RefreshCw size={14} color="var(--text-secondary)" />
                    </button>
                    <HardDrive size={16} color="var(--accent-cyan)" />
                    <span onClick={() => handleNavigate(currentRoot ? currentRoot.path : '/sdcard')} style={{ cursor: 'pointer', color: 'var(--accent-cyan)' }}>
                        {currentRoot ? currentRoot.name : 'Internal Storage'}
                    </span>
                    {crumbParts.map((part, index) => {
                        const subPath = '/' + pathParts.slice(0, rootParts.length + index + 1).join('/');
                        return (
                            <React.Fragment key={subPath}>
                                <ChevronRight size={14} color="var(--text-muted)" />
                                <span
                                    onClick={() => handleNavigate(subPath)}
                                    style={{
                                        cursor: 'pointer',
                                        color: index === crumbParts.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        fontWeight: index === crumbParts.length - 1 ? 600 : 400
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

            {/* Loading State */}
            {isLoading ? (
                <div className="glass-panel" style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: 'var(--text-muted)' }}>
                    <Loader size={28} className="spin" color="var(--accent-cyan)" />
                    <div style={{ fontSize: '13px' }}>Loading {currentPath}...</div>
                </div>
            ) : error ? (
                <div className="glass-panel" style={{ padding: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', textAlign: 'center', color: 'var(--accent-rose)' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{error}</div>
                    {!device?.connected && (
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            No device connected. Pair and connect your phone, then make sure the KDE Connect SFTP plugin has file access.
                        </div>
                    )}
                    <button className="btn-secondary" onClick={() => loadDirectory(currentPath)} style={{ fontSize: '12px', padding: '6px 14px' }}>
                        <RefreshCw size={13} style={{ marginRight: '6px' }} /> Retry
                    </button>
                </div>
            ) : filteredFiles.length === 0 ? (
                <div className="glass-panel" style={{ padding: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Folder size={28} color="var(--text-muted)" />
                    <div style={{ fontSize: '13px' }}>
                        {searchQuery ? 'No files match your search.' : 'This folder is empty. Drag & drop files here to upload them.'}
                    </div>
                </div>
            ) : viewMode === 'grid' ? (
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
