'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Search, Download, Trash2, Plus, Database as DbIcon, AlertTriangle } from 'lucide-react';
import UploadModal from '@/components/UploadModal';
import styles from '@/styles/Database.module.css';

const DEVICE_CATEGORIES = [
  'All', 
  'Receiver', 
  'Router', 
  'TV', 
  'TV Box', 
  'PC BIOS', 
  'EC Firmware', 
  'EEPROM Dump', 
  'Automotive', 
  'Printer', 
  'Other'
];

export default function DatabasePage() {
  const { data: session } = useSession();
  const [firmwares, setFirmwares] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  
  // Pagination / Infinite Load
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    totalItems: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 10
  });

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // A local refresh trigger incremented to force list reload programmatically without page reloads
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Debounced Search Input state (triggers fetch on change)
  const [searchQuery, setSearchQuery] = useState('');

  // Is verified check
  const isVerifiedUploader = session?.user ? session.user.verified !== false : false;

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(search);
    }, 400);

    return () => clearTimeout(handler);
  }, [search]);

  // Initial load or filter change -> reset list and load page 1
  useEffect(() => {
    const resetAndFetch = async () => {
      setLoading(true);
      try {
        const typeFilter = category === 'All' ? '' : category;
        const res = await fetch(
          `/api/firmware?search=${encodeURIComponent(searchQuery)}&device_type=${encodeURIComponent(typeFilter)}&page=1&limit=10&t=${Date.now()}`
        );
        if (!res.ok) throw new Error('Failed to load firmwares');
        const data = await res.json();
        setFirmwares(data.firmwares || []);
        setPagination(data.pagination || { totalItems: 0, totalPages: 1, currentPage: 1, limit: 10 });
        setPage(1);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    resetAndFetch();
  }, [searchQuery, category, refreshTrigger]);

  // Load more pages and append to existing list
  const loadMore = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const typeFilter = category === 'All' ? '' : category;
      const res = await fetch(
        `/api/firmware?search=${encodeURIComponent(searchQuery)}&device_type=${encodeURIComponent(typeFilter)}&page=${nextPage}&limit=10&t=${Date.now()}`
      );
      if (!res.ok) throw new Error('Failed to load more');
      const data = await res.json();
      setFirmwares(prev => [...prev, ...(data.firmwares || [])]);
      setPagination(data.pagination || { totalItems: 0, totalPages: 1, currentPage: nextPage, limit: 10 });
      setPage(nextPage);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDelete = async (id, model) => {
    if (!isVerifiedUploader) return;
    if (!window.confirm(`Are you sure you want to delete the firmware for "${model}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/firmware/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete firmware');
      }

      // Increment refresh trigger to trigger a clean programmatic reload
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      alert(err.message);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getCategoryBadgeClass = (type) => {
    switch (type) {
      case 'Receiver': return styles.badgeReceiver;
      case 'Router': return styles.badgeRouter;
      case 'TV': return styles.badgeTV;
      case 'TV Box': return styles.badgeTVBox;
      case 'PC BIOS': return styles.badgeReceiver; // Reuse styles for visual consistency
      case 'EC Firmware': return styles.badgeRouter;
      case 'EEPROM Dump': return styles.badgeTV;
      case 'Automotive': return styles.badgeTVBox;
      default: return styles.badgeOther;
    }
  };

  return (
    <main className={styles.dbPage}>
      {/* Warning banner for unverified uploaders */}
      {session && !isVerifiedUploader && (
        <div className={styles.warningBanner}>
          <AlertTriangle size={18} />
          <span>Your uploader account is pending verification. File uploads and deletions are disabled.</span>
        </div>
      )}

      <div className={styles.headerRow}>
        <div>
          <h2>Firmware Database</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Find and download verified ROMs and dump files for various devices.
          </p>
        </div>
        {session && (
          <button 
            onClick={() => setShowUploadModal(true)} 
            disabled={!isVerifiedUploader}
            className="btn btn-accent" 
            style={{ 
              width: 'auto', 
              gap: '6px', 
              opacity: isVerifiedUploader ? 1 : 0.5, 
              cursor: isVerifiedUploader ? 'pointer' : 'not-allowed' 
            }}
            title={isVerifiedUploader ? 'Upload new firmware file' : 'Account verification pending'}
          >
            <Plus size={16} />
            Upload Firmware
          </button>
        )}
      </div>

      <div className={styles.controlsRow}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by device model, details, or version..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select 
          className={styles.filterSelect}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {DEVICE_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat} (Category)</option>
          ))}
        </select>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableWrapper}>
          {loading ? (
            <div className={styles.emptyState}>
              <div className={styles.spinner} style={{ width: '24px', height: '24px' }} />
              <span>Loading firmware repository...</span>
            </div>
          ) : firmwares.length === 0 ? (
            <div className={styles.emptyState}>
              <DbIcon size={40} className={styles.emptyStateIcon} />
              <h4>No firmwares found</h4>
              <p>Try refining your search query or choosing another category.</p>
            </div>
          ) : (
            <table className={styles.fwTable}>
              <thead>
                <tr>
                  <th>Device Model</th>
                  <th>Category</th>
                  <th>Version</th>
                  <th>Description</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th>Downloads</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {firmwares.map((fw) => {
                  const isOwner = session?.user?.id === fw.uploaded_by;
                  const isAdmin = session?.user?.is_admin === true;
                  const canDelete = session && isVerifiedUploader && (isOwner || isAdmin);

                  return (
                    <tr key={fw.id}>
                      <td style={{ fontWeight: 600, color: 'var(--white)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span>{fw.device_model}</span>
                          <span style={{ 
                            fontSize: '0.68rem', 
                            fontWeight: 600, 
                            color: fw.is_dump ? '#eab308' : '#60a5fa', 
                            textTransform: 'uppercase', 
                            letterSpacing: '0.03em' 
                          }}>
                            {fw.is_dump ? '📁 Dump (From Device)' : '⚡ Official Release'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.deviceBadge} ${getCategoryBadgeClass(fw.device_type)}`}>
                          {fw.device_type}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{fw.version}</td>
                      <td>
                        <span className={styles.descText} title={fw.description || 'No description'}>
                          {fw.description || '—'}
                        </span>
                      </td>
                      <td>{formatBytes(fw.file_size)}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                        {new Date(fw.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td style={{ textAlign: 'center' }}>{fw.downloads_count}</td>
                      <td>
                        <div className={styles.actionCell}>
                          <a 
                            href={`/api/firmware/${fw.id}/download`}
                            className={styles.actionIconBtn}
                            title="Download firmware"
                          >
                            <Download size={15} />
                          </a>
                          {canDelete && (
                            <button 
                              onClick={() => handleDelete(fw.id, fw.device_model)}
                              className={`${styles.actionIconBtn} ${styles.deleteBtn}`}
                              title="Delete firmware"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Load More Button Row */}
        {!loading && page < pagination.totalPages && (
          <div className={styles.loadMoreRow}>
            <button
              disabled={loadingMore}
              onClick={loadMore}
              className="btn btn-ghost"
              style={{ width: 'auto', minWidth: '150px' }}
            >
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>

      {showUploadModal && (
        <UploadModal 
          onClose={() => setShowUploadModal(false)} 
          onSuccess={() => {
            setShowUploadModal(false);
            // Reset filters to ensure the new upload is immediately visible
            setCategory('All');
            setSearch('');
            setSearchQuery('');
            // Increment refresh trigger to trigger a clean programmatic reload
            setRefreshTrigger(prev => prev + 1);
          }}
        />
      )}
    </main>
  );
}
