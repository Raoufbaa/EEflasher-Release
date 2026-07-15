'use client';

import { useState, useEffect, Fragment } from 'react';
import { useSession } from 'next-auth/react';
import { Search, Download, Trash2, Plus, Database as DbIcon, AlertTriangle, ShieldAlert, Cpu, ChevronDown, ChevronRight } from 'lucide-react';
import UploadModal from '@/components/UploadModal';
import AddChipModal from '@/components/AddChipModal';
import styles from '@/styles/Database.module.css';

const DEVICE_CATEGORIES = [
  'All',
  'Receiver',
  'Router',
  'TV',
  'TV Box',
  'Desktop BIOS',
  'Laptop BIOS',
  'EC Firmware',
  'EEPROM Dump',
  'Automotive',
  'Printer',
  'Other'
];

export default function DatabasePage() {
  const { data: session, update: updateSession } = useSession();
  const [deviceModels, setDeviceModels] = useState([]);
  const [expandedModels, setExpandedModels] = useState({});
  const [modelFirmwares, setModelFirmwares] = useState({});
  const [loadingModelFirmwares, setLoadingModelFirmwares] = useState({});
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  // Tabs
  const [activeTab, setActiveTab] = useState('firmware'); // 'firmware' or 'chips'
  const [chips, setChips] = useState([]);
  const [chipsLoading, setChipsLoading] = useState(false);
  const [showAddChipModal, setShowAddChipModal] = useState(false);
  const [pendingChips, setPendingChips] = useState([]);
  const [loadingPendingChips, setLoadingPendingChips] = useState(false);

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
  const [initialUploadData, setInitialUploadData] = useState(null);

  // A local refresh trigger incremented to force list reload programmatically without page reloads
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Debounced Search Input state (triggers fetch on change)
  const [searchQuery, setSearchQuery] = useState('');

  // Is verified check
  const isVerifiedUploader = session?.user ? session.user.verified !== false : false;

  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState(false);

  // OTP Modal states
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');

  const handleOtpDigitChange = (val, idx) => {
    const cleanVal = val.replace(/[^0-9]/g, '');
    const newOtpDigits = [...otpDigits];
    newOtpDigits[idx] = cleanVal.slice(-1);
    setOtpDigits(newOtpDigits);

    // Auto-focus next input
    if (cleanVal && idx < 5) {
      const nextInput = document.getElementById(`otp-digit-${idx + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpDigitKeyDown = (e, idx) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[idx] && idx > 0) {
        const prevInput = document.getElementById(`otp-digit-${idx - 1}`);
        if (prevInput) {
          prevInput.focus();
          const newOtpDigits = [...otpDigits];
          newOtpDigits[idx - 1] = '';
          setOtpDigits(newOtpDigits);
        }
      }
    }
  };

  const handleOtpDigitPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasted)) {
      const digits = pasted.split('');
      setOtpDigits(digits);
      const lastInput = document.getElementById('otp-digit-5');
      if (lastInput) lastInput.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpCode = otpDigits.join('');
    if (otpCode.length !== 6) {
      setOtpError('Please enter all 6 digits.');
      return;
    }

    setVerifyingOtp(true);
    setOtpError('');
    setOtpSuccess('');

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ otp: otpCode }),
      });

      const data = await res.json();

      if (res.ok) {
        setOtpSuccess(data.message || 'Verification successful!');
        // Update local session state dynamically
        await updateSession();
        // Auto close after 1.5 seconds
        setTimeout(() => {
          closeVerifyModal();
        }, 1500);
      } else {
        setOtpError(data.error || 'Failed to verify OTP.');
      }
    } catch (err) {
      console.error('OTP verification error:', err);
      setOtpError('An unexpected error occurred. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const closeVerifyModal = () => {
    setShowVerifyModal(false);
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError('');
    setOtpSuccess('');
    setVerifyingOtp(false);
  };

  const handleResendVerification = async () => {
    if (!session?.user?.email) return;
    setResending(true);
    setResendMessage('');
    setResendError(false);

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: session.user.email }),
      });

      const data = await res.json();

      if (res.ok) {
        setResendMessage(data.message || 'Verification link sent!');
      } else {
        setResendError(true);
        setResendMessage(data.error || 'Failed to resend verification link.');
      }
    } catch (err) {
      console.error('Error resending verification:', err);
      setResendError(true);
      setResendMessage('An unexpected error occurred. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const [pendingModels, setPendingModels] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const fetchPendingModels = async () => {
    setLoadingPending(true);
    try {
      const res = await fetch('/api/admin/models');
      if (res.ok) {
        const data = await res.json();
        setPendingModels(data.models || []);
      }
    } catch (err) {
      console.error("Failed to load pending models:", err);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    if (session?.user?.is_admin === true) {
      const timer = setTimeout(() => {
        fetchPendingModels();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [session, refreshTrigger]);

  const fetchPendingChips = async () => {
    setLoadingPendingChips(true);
    try {
      const res = await fetch('/api/admin/chips');
      if (res.ok) {
        const data = await res.json();
        setPendingChips(data.chips || []);
      }
    } catch (err) {
      console.error("Failed to load pending chips:", err);
    } finally {
      setLoadingPendingChips(false);
    }
  };

  useEffect(() => {
    if (session?.user?.is_admin === true) {
      const timer = setTimeout(() => {
        fetchPendingChips();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [session, refreshTrigger]);

  const handleApproveModel = async (modelId) => {
    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', modelId })
      });
      if (!res.ok) throw new Error("Failed to approve model");
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleMergeModel = async (typoModelId, typoName) => {
    const canonicalModelName = window.prompt(`Merge typo model "${typoName}". Enter the correct target model name:`, typoName);
    if (!canonicalModelName || !canonicalModelName.trim()) return;

    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'merge',
          typoModelId,
          canonicalModelName: canonicalModelName.trim()
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to merge model");
      }
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRejectModel = async (modelId, name) => {
    if (!window.confirm(`Are you sure you want to reject and delete the model "${name}"? This will delete all firmwares and storage files uploaded under this model!`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', modelId })
      });
      if (!res.ok) throw new Error("Failed to delete model");
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleApproveChip = async (chipId) => {
    try {
      const res = await fetch('/api/admin/chips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', chipId })
      });
      if (!res.ok) throw new Error("Failed to approve chip");
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRejectChip = async (chipId, modelName) => {
    if (!window.confirm(`Are you sure you want to reject and delete the chip "${modelName}"?`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/chips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', chipId })
      });
      if (!res.ok) throw new Error("Failed to reject chip");
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(search);
    }, 400);

    return () => clearTimeout(handler);
  }, [search]);

  const toggleModelExpand = async (modelId) => {
    const isCurrentlyExpanded = !!expandedModels[modelId];

    setExpandedModels(prev => ({
      ...prev,
      [modelId]: !isCurrentlyExpanded
    }));

    if (!isCurrentlyExpanded && !modelFirmwares[modelId]) {
      setLoadingModelFirmwares(prev => ({ ...prev, [modelId]: true }));
      try {
        const res = await fetch(`/api/firmware?model_id=${modelId}&t=${Date.now()}`);
        if (!res.ok) throw new Error('Failed to load firmwares for this model');
        const data = await res.json();
        setModelFirmwares(prev => ({
          ...prev,
          [modelId]: data.firmwares || []
        }));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingModelFirmwares(prev => ({ ...prev, [modelId]: false }));
      }
    }
  };

  // Check URL parameters for desktop save online redirection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('upload') === 'true') {
        const fileName = params.get('fileName') || '';
        const fileSize = parseInt(params.get('fileSize') || '0', 10);
        const checksum = params.get('checksum') || '';
        const deviceModel = params.get('deviceModel') || '';
        const deviceType = params.get('deviceType') || '';
        setInitialUploadData({ fileName, fileSize, checksum, deviceModel, deviceType });
        setShowUploadModal(true);
        // Clean URL parameters from display to keep it clean
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Initial load or filter change -> reset list and load page 1 for models
  useEffect(() => {
    if (activeTab !== 'firmware') return;
    const resetAndFetch = async () => {
      setLoading(true);
      try {
        const typeFilter = category === 'All' ? '' : category;
        const res = await fetch(
          `/api/firmware?search=${encodeURIComponent(searchQuery)}&device_type=${encodeURIComponent(typeFilter)}&page=1&limit=10&t=${Date.now()}`
        );
        if (!res.ok) throw new Error('Failed to load models');
        const data = await res.json();
        setDeviceModels(data.models || []);
        setPagination(data.pagination || { totalItems: 0, totalPages: 1, currentPage: 1, limit: 10 });
        setPage(1);
        setExpandedModels({});
        setModelFirmwares({});
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    resetAndFetch();
  }, [searchQuery, category, refreshTrigger, activeTab]);

  // Load chips when chips tab is active
  useEffect(() => {
    if (activeTab !== 'chips') return;

    const fetchChipsList = async () => {
      setChipsLoading(true);
      try {
        const res = await fetch(
          `/api/chips?search=${encodeURIComponent(searchQuery)}&t=${Date.now()}`
        );
        if (!res.ok) throw new Error('Failed to load chips');
        const data = await res.json();
        setChips(data.chips || []);
      } catch (err) {
        console.error(err);
      } finally {
        setChipsLoading(false);
      }
    };

    fetchChipsList();
  }, [searchQuery, refreshTrigger, activeTab]);


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
      setDeviceModels(prev => [...prev, ...(data.models || [])]);
      setPagination(data.pagination || { totalItems: 0, totalPages: 1, currentPage: nextPage, limit: 10 });
      setPage(nextPage);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDelete = async (id, modelName, modelId) => {
    if (!isVerifiedUploader) return;
    if (!window.confirm(`Are you sure you want to delete the firmware for "${modelName}"?`)) {
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

      if (modelId) {
        setModelFirmwares(prev => {
          const updated = { ...prev };
          if (updated[modelId]) {
            updated[modelId] = updated[modelId].filter(f => f.id !== id);
          }
          return updated;
        });
      }

      // Increment refresh trigger to trigger a clean programmatic reload of the models list
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
      case 'Desktop BIOS':
      case 'Laptop BIOS': return styles.badgeReceiver; // Reuse styles for visual consistency
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
          <div className={styles.warningBannerLeft}>
            <AlertTriangle size={18} />
            <span>
              {resendMessage
                ? resendMessage
                : "Your uploader account is pending verification. File uploads, deletions, and chip additions are disabled."
              }
            </span>
          </div>
          <div className={styles.warningBannerActions}>
            {!resendMessage && (
              <button
                onClick={handleResendVerification}
                disabled={resending}
                className={`btn ${styles.bannerActionBtn} ${styles.bannerBtnWarning}`}
              >
                {resending ? 'Sending...' : 'Resend Email'}
              </button>
            )}
            {resendMessage && resendError && (
              <button
                onClick={() => { setResendMessage(''); setResendError(false); }}
                className={`btn ${styles.bannerActionBtn} ${styles.bannerBtnDanger}`}
              >
                Try Again
              </button>
            )}
            <button
              onClick={() => setShowVerifyModal(true)}
              className={`btn btn-accent ${styles.bannerActionBtn} ${styles.bannerBtnAccent}`}
            >
              Verify Code
            </button>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className={styles.headerRow}>
        <div>
          <h2>{activeTab === 'firmware' ? 'Firmware Database' : 'Supported Chips Directory'}</h2>
          <p>
            {activeTab === 'firmware'
              ? 'Find and download verified ROMs and dump files for various devices.'
              : 'Browse and search our database of supported EEPROM and Flash memory chips.'}
          </p>
        </div>
        {session && (
          <div>
            {activeTab === 'firmware' ? (
              <button
                onClick={() => setShowUploadModal(true)}
                disabled={!isVerifiedUploader}
                className={`btn btn-accent ${styles.headerUploadBtn}`}
                title={isVerifiedUploader ? 'Upload new firmware file' : 'Account verification pending'}
              >
                <Plus size={16} />
                Upload Firmware
              </button>
            ) : (
              <button
                onClick={() => setShowAddChipModal(true)}
                disabled={!isVerifiedUploader}
                className={`btn btn-accent ${styles.headerUploadBtn}`}
                title={isVerifiedUploader ? 'Add new supported chip' : 'Account verification pending'}
              >
                <Plus size={16} />
                Submit New Chip
              </button>
            )}
          </div>
        )}
      </div>

      {/* Segmented Tab Controls */}
      <div className={styles.tabsContainer}>
        <button
          onClick={() => {
            setActiveTab('firmware');
            setSearch('');
            setSearchQuery('');
          }}
          className={`btn ${styles.tabBtn} ${activeTab === 'firmware' ? styles.tabBtnActive : ''}`}
        >
          📁 Firmware Database
        </button>
        <button
          onClick={() => {
            setActiveTab('chips');
            setSearch('');
            setSearchQuery('');
          }}
          className={`btn ${styles.tabBtn} ${activeTab === 'chips' ? styles.tabBtnActive : ''}`}
        >
          <Cpu size={14} className={styles.tabIcon} />
          Supported Chips List
        </button>
      </div>

      {/* Admin Panel: Pending Models Review (Firmware Tab only) */}
      {activeTab === 'firmware' && session && session.user.is_admin === true && pendingModels.length > 0 && (
        <div className={styles.adminReviewPanel}>
          <div className={styles.adminReviewHeader}>
            <h3 className={styles.adminReviewTitle}>
              <ShieldAlert size={20} />
              Pending Device Models Review ({pendingModels.length})
            </h3>
            <span className={styles.adminReviewSubtitle}>Requires admin approval to be visible to public users</span>
          </div>

          <div className={styles.adminTableWrapper}>
            <table className={styles.adminTable}>
              <thead>
                <tr className={styles.adminTableHeaderRow}>
                  <th className={styles.adminTableHeader}>Device Model</th>
                  <th className={styles.adminTableHeader}>Type</th>
                  <th className={styles.adminTableHeader}>Uploads</th>
                  <th className={styles.adminTableHeader}>Submitted</th>
                  <th className={`${styles.adminTableHeader} ${styles.adminTableCellRight}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingModels.map(model => (
                  <tr key={model.id} className={styles.adminTableRow}>
                    <td className={styles.adminTableCellModel}>{model.model_name}</td>
                    <td className={styles.adminTableCell}>
                      <span className={`${styles.deviceBadge} ${getCategoryBadgeClass(model.device_type)}`}>
                        {model.device_type}
                      </span>
                    </td>
                    <td className={styles.adminTableCell}>{model.firmwares_count} firmware(s)</td>
                    <td className={`${styles.adminTableCell} ${styles.adminTableCellDate}`}>
                      {new Date(model.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className={`${styles.adminTableCell} ${styles.adminTableCellRight}`}>
                      <div className={styles.adminActions}>
                        <button
                          onClick={() => handleApproveModel(model.id)}
                          className={`btn btn-accent ${styles.adminBtn}`}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleMergeModel(model.id, model.model_name)}
                          className={`btn btn-ghost ${styles.adminBtn} ${styles.adminBtnGhostAccent}`}
                        >
                          Merge
                        </button>
                        <button
                          onClick={() => handleRejectModel(model.id, model.model_name)}
                          className={`btn btn-ghost ${styles.adminBtn} ${styles.adminBtnGhostDanger}`}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin Panel: Pending Chips Review (Chips Tab only) */}
      {activeTab === 'chips' && session && session.user.is_admin === true && pendingChips.length > 0 && (
        <div className={styles.adminReviewPanel}>
          <div className={styles.adminReviewHeader}>
            <h3 className={styles.adminReviewTitle}>
              <ShieldAlert size={20} />
              Pending Chips Review ({pendingChips.length})
            </h3>
            <span className={styles.adminReviewSubtitle}>Requires admin approval to be added to the supported database</span>
          </div>

          <div className={styles.adminTableWrapper}>
            <table className={styles.adminTable}>
              <thead>
                <tr className={styles.adminTableHeaderRow}>
                  <th className={styles.adminTableHeader}>Manufacturer</th>
                  <th className={styles.adminTableHeader}>Model</th>
                  <th className={styles.adminTableHeader}>Hex ID</th>
                  <th className={styles.adminTableHeader}>Protocol</th>
                  <th className={styles.adminTableHeader}>Size</th>
                  <th className={`${styles.adminTableHeader} ${styles.adminTableCellRight}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingChips.map(chip => (
                  <tr key={chip.id} className={styles.adminTableRow}>
                    <td className={styles.adminTableCellModel}>{chip.manufacturer}</td>
                    <td className={styles.adminTableCellModel}>{chip.model}</td>
                    <td className={styles.adminTableCell} style={{ fontFamily: 'monospace' }}>{chip.idHex}</td>
                    <td className={styles.adminTableCell}>{chip.protocol}</td>
                    <td className={styles.adminTableCell}>{formatBytes(chip.size)}</td>
                    <td className={`${styles.adminTableCell} ${styles.adminTableCellRight}`}>
                      <div className={styles.adminActions}>
                        <button
                          onClick={() => handleApproveChip(chip.id)}
                          className={`btn btn-accent ${styles.adminBtn}`}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectChip(chip.id, chip.model)}
                          className={`btn btn-ghost ${styles.adminBtn} ${styles.adminBtnGhostDanger}`}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Controls Row */}
      <div className={styles.controlsRow}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder={activeTab === 'firmware' ? 'Search by device model, details, or version...' : 'Search by chip manufacturer, model, or JEDEC ID...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {activeTab === 'firmware' && (
          <select
            className={styles.filterSelect}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {DEVICE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat} (Category)</option>
            ))}
          </select>
        )}
      </div>

      {/* Main Database Table Card */}
      <div className={styles.tableCard}>
        <div className={styles.tableWrapper}>
          {/* Tab 1: Firmware Repository */}
          {activeTab === 'firmware' && (
            loading ? (
              <div className={styles.emptyState}>
                <div className="spinner" style={{ width: '24px', height: '24px' }} />
                <span>Loading firmware repository...</span>
              </div>
            ) : deviceModels.length === 0 ? (
              <div className={styles.emptyState}>
                <DbIcon size={40} className={styles.emptyStateIcon} />
                <h4>No device models found</h4>
                <p>Try refining your search query or choosing another category.</p>
              </div>
            ) : (
              <table className={`${styles.fwTable} ${styles.firmwareTable}`}>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}></th>
                    <th>Device Model</th>
                    <th>Category</th>
                    <th>Available Files</th>
                    <th>Latest Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {deviceModels.map((model) => {
                    const isExpanded = !!expandedModels[model.id];
                    return (
                      <Fragment key={model.id}>
                        <tr
                          onClick={() => toggleModelExpand(model.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td style={{ textAlign: 'center' }}>
                            {isExpanded ? (
                              <ChevronDown size={18} className={styles.expandIcon} />
                            ) : (
                              <ChevronRight size={18} className={styles.expandIcon} />
                            )}
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--white)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                              <span>{model.model_name}</span>
                              {model.is_approved === false && (
                                <span style={{
                                  fontSize: '0.6rem',
                                  fontWeight: 600,
                                  color: '#ef4444',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.03em',
                                  whiteSpace: 'nowrap'
                                }}>
                                  Pending Approval
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={`${styles.deviceBadge} ${getCategoryBadgeClass(model.device_type)}`}>
                              {model.device_type}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 500, color: 'var(--text)' }}>
                              {model.firmware_count} {model.firmware_count === 1 ? 'file' : 'files'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                            {new Date(model.latest_upload).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className={styles.expandedRow}>
                            <td colSpan={5} className={styles.expandedCell}>
                              {loadingModelFirmwares[model.id] ? (
                                <div className={styles.nestedLoading}>
                                  <div className="spinner" style={{ width: '16px', height: '16px' }} />
                                  <span>Fetching available firmware files...</span>
                                </div>
                              ) : !modelFirmwares[model.id] || modelFirmwares[model.id].length === 0 ? (
                                <div className={styles.nestedEmpty}>
                                  <span>No firmware files found for this model.</span>
                                </div>
                              ) : (
                                <div className={styles.nestedContainer}>
                                  {modelFirmwares[model.id].map((fw) => {
                                    const isOwner = session?.user?.id === fw.uploaded_by;
                                    const isAdmin = session?.user?.is_admin === true;
                                    const canDelete = session && isVerifiedUploader && (isOwner || isAdmin);

                                    return (
                                      <div key={fw.id} className={styles.fwFileRow}>
                                        <div className={styles.fwFileLeft}>
                                          <span className={fw.is_dump ? styles.badgeDump : styles.badgeOfficial}>
                                            {fw.is_dump ? 'Dump' : 'Official'}
                                          </span>
                                          <span className={styles.fwVersionText}>{fw.version}</span>
                                          <span className={styles.fwSizeText}>{formatBytes(fw.file_size)}</span>
                                        </div>

                                        <div className={styles.fwDescText} title={fw.description || 'No description'}>
                                          {fw.description || '-'}
                                        </div>

                                        <div className={styles.fwFileRight}>
                                          <span className={styles.fwDateText} title={fw.checksum ? `SHA-256: ${fw.checksum}` : 'No Checksum'}>
                                            Uploaded {new Date(fw.created_at).toLocaleDateString(undefined, {
                                              month: 'short',
                                              day: 'numeric',
                                              year: 'numeric'
                                            })}
                                          </span>
                                          <span className={styles.fwDownloadsText}>{fw.downloads_count} downloads</span>

                                          <div className={styles.actionCell}>
                                            <a
                                              href={`/api/firmware/${fw.id}/download`}
                                              className={styles.actionIconBtn}
                                              title="Download firmware"
                                            >
                                              <Download size={14} />
                                            </a>
                                            {canDelete && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDelete(fw.id, model.model_name, model.id);
                                                }}
                                                className={`${styles.actionIconBtn} ${styles.deleteBtn}`}
                                                title="Delete firmware"
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )
          )}

          {/* Tab 2: Chips Directory */}
          {activeTab === 'chips' && (
            chipsLoading ? (
              <div className={styles.emptyState}>
                <div className="spinner" style={{ width: '24px', height: '24px' }} />
                <span>Loading supported chips directory...</span>
              </div>
            ) : chips.length === 0 ? (
              <div className={styles.emptyState}>
                <Cpu size={40} className={styles.emptyStateIcon} />
                <h4>No supported chips found</h4>
                <p>Try refining your search query.</p>
              </div>
            ) : (
              <table className={`${styles.fwTable} ${styles.chipsTable}`}>
                <thead>
                  <tr>
                    <th>Manufacturer</th>
                    <th>Model</th>
                    <th>Hex JEDEC ID</th>
                    <th>Size</th>
                    <th>Page Size</th>
                    <th>Protocol</th>
                    <th>SPI Command</th>
                    <th>VCC</th>
                  </tr>
                </thead>
                <tbody>
                  {chips.map((chip, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: 'var(--white)' }}>{chip.manufacturer}</td>
                      <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{chip.model}</td>
                      <td style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}>{chip.id}</td>
                      <td>{formatBytes(chip.size)}</td>
                      <td>{chip.pageSize} Bytes</td>
                      <td>
                        <span className={`${styles.deviceBadge} ${styles.badgeReceiver}`}>
                          {chip.protocol}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{chip.spiCommand}</td>
                      <td style={{ fontWeight: 600 }}>{chip.vcc}V</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* Load More Button Row (Firmware tab pagination only) */}
        {activeTab === 'firmware' && !loading && page < pagination.totalPages && (
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

      {/* Modals */}
      {showUploadModal && (
        <UploadModal
          onClose={() => {
            setShowUploadModal(false);
            setInitialUploadData(null);
          }}
          onSuccess={() => {
            setShowUploadModal(false);
            setInitialUploadData(null);
            setCategory('All');
            setSearch('');
            setSearchQuery('');
            setRefreshTrigger(prev => prev + 1);
          }}
          initialData={initialUploadData}
        />
      )}

      {showAddChipModal && (
        <AddChipModal
          onClose={() => setShowAddChipModal(false)}
          onSuccess={() => {
            setShowAddChipModal(false);
            setSearch('');
            setSearchQuery('');
            setRefreshTrigger(prev => prev + 1);
          }}
        />
      )}

      {/* OTP Verification Modal */}
      {showVerifyModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(11, 14, 16, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeUp 0.3s ease both'
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r)',
              width: '100%',
              maxWidth: '400px',
              padding: '32px 24px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <img src="https://i0b6tkdu1q.ufs.sh/f/XAiYDdRKAy97uNDG9cUFnyzR5Io9UVHOhGge8qYbPMs2irJA" alt="EEFlasher Logo" style={{ width: '56px', height: '56px', borderRadius: '8px' }} />
            </div>

            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--white)', marginBottom: '8px' }}>Confirm Verification</h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--muted)', textAlign: 'center', marginBottom: '24px' }}>
              We&apos;ve sent a 6-digit OTP code to your email. Please enter it below.
            </p>

            {otpError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                  fontSize: '0.82rem',
                  padding: '10px 14px',
                  borderRadius: 'var(--r-sm)',
                  marginBottom: '20px',
                  width: '100%',
                  textAlign: 'center'
                }}
              >
                {otpError}
              </div>
            )}

            {otpSuccess && (
              <div
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  color: '#4ade80',
                  fontSize: '0.82rem',
                  padding: '10px 14px',
                  borderRadius: 'var(--r-sm)',
                  marginBottom: '20px',
                  width: '100%',
                  textAlign: 'center'
                }}
              >
                {otpSuccess}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-digit-${idx}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpDigitChange(e.target.value, idx)}
                  onKeyDown={(e) => handleOtpDigitKeyDown(e, idx)}
                  onPaste={handleOtpDigitPaste}
                  disabled={verifyingOtp || !!otpSuccess}
                  style={{
                    width: '42px',
                    height: '48px',
                    fontSize: '1.4rem',
                    fontWeight: '700',
                    textAlign: 'center',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-sm)',
                    color: 'var(--white)',
                    outline: 'none',
                    transition: 'border-color var(--trans)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button
                onClick={closeVerifyModal}
                disabled={verifyingOtp}
                className="btn btn-ghost"
                style={{ flex: 1, height: '40px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyOtp}
                disabled={verifyingOtp || otpDigits.some(d => !d) || !!otpSuccess}
                className="btn btn-accent"
                style={{ flex: 1, height: '40px' }}
              >
                {verifyingOtp ? 'Verifying...' : 'Verify OTP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

