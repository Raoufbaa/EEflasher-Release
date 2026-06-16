'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UploadCloud, File, AlertTriangle } from 'lucide-react';
import styles from '@/styles/UploadModal.module.css';

const DEVICE_TYPES = ['Receiver', 'Router', 'TV', 'TV Box', 'PC BIOS', 'EC Firmware', 'EEPROM Dump', 'Automotive', 'Printer', 'Other'];

function formatModelName(name) {
  if (!name) return '';
  let formatted = name.toUpperCase().trim();
  // Insert hyphen between letters and digits (e.g. HG532 -> HG-532)
  formatted = formatted.replace(/([A-Z]+)(?=\d)/g, '$1-');
  return formatted;
}

export default function UploadModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [deviceModel, setDeviceModel] = useState('');
  const [deviceType, setDeviceType] = useState('Receiver');
  const [customType, setCustomType] = useState('');
  const [version, setVersion] = useState('');
  const [description, setDescription] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const [isDump, setIsDump] = useState(false); // default to false (Clean / Official Release)
  const [isCheckingModel, setIsCheckingModel] = useState(false);
  const [modelMessage, setModelMessage] = useState('');

  // Autocomplete model suggestions states & ref
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    // Lock body scroll when modal is active
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Close suggestions on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch autocompletion model suggestions with debounce
  useEffect(() => {
    if (!deviceModel.trim()) {
      setSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const activeType = deviceType === 'Other' ? customType : deviceType;
        const res = await fetch(`/api/firmware/suggest-models?search=${encodeURIComponent(deviceModel.trim())}&device_type=${encodeURIComponent(activeType)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
        }
      } catch (err) {
        console.warn("Error loading suggestions:", err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [deviceModel, deviceType, customType]);

  const handleSelectSuggestion = (modelName) => {
    setDeviceModel(formatModelName(modelName));
    setShowSuggestions(false);
    setModelMessage('Model name formatted.');
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const calculateChecksum = async (selectedFile) => {
    setStatusText('Generating file checksum locally...');
    const arrayBuffer = await selectedFile.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  const handleModelBlur = async () => {
    if (!deviceModel.trim()) return;

    // Format input locally first
    const localFormatted = formatModelName(deviceModel);
    setDeviceModel(localFormatted);

    setIsCheckingModel(true);
    setModelMessage('');
    try {
      const res = await fetch(`/api/firmware/check-model?model=${encodeURIComponent(localFormatted)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.recommendedName && data.recommendedName !== localFormatted) {
          setDeviceModel(formatModelName(data.recommendedName));
          if (data.source === 'database') {
            setModelMessage('Matched existing database device model.');
          } else if (data.source === 'internet') {
            setModelMessage('Format unified using internet lookup.');
          }
        }
      }
    } catch (err) {
      console.warn('Failed to check model:', err);
    } finally {
      setIsCheckingModel(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a firmware file first.');
      return;
    }

    setLoading(true);
    setError('');
    setStatusText('Initializing upload...');

    try {
      // 1. Calculate SHA-256 Checksum
      const checksum = await calculateChecksum(file);

      // 2. Fetch Pre-signed S3 PUT URL
      setStatusText('Retrieving Backblaze B2 upload credentials...');
      const presignRes = await fetch('/api/firmware/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: file.name,
          file_size: file.size,
          file_type: file.type || 'application/octet-stream'
        })
      });

      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        throw new Error(presignData.error || 'Failed to authorize upload.');
      }

      const { upload_url, file_key } = presignData;

      // 3. Upload File directly to Backblaze B2 with progress tracking
      setStatusText('Uploading firmware to Backblaze storage...');
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', upload_url);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve();
          } else {
            reject(new Error(`Backblaze storage returned HTTP ${xhr.status}.`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error uploading file.'));
        xhr.send(file);
      });

      // 4. Save metadata to Postgres Database
      setStatusText('Saving firmware details to database...');
      const finalType = deviceType === 'Other' ? customType : deviceType;
      
      const saveRes = await fetch('/api/firmware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_model: deviceModel,
          device_type: finalType,
          version,
          description,
          file_key,
          file_name: file.name,
          file_size: file.size,
          checksum,
          is_dump: isDump
        })
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveData.error || 'Failed to save firmware metadata.');
      }

      setStatusText('Complete!');
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during upload.');
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!mounted) return null;

  return createPortal(
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h3>Upload New Firmware</h3>
        <button className={styles.closeBtn} onClick={onClose} disabled={loading}>
          <X size={20} />
        </button>

        {error && (
          <div className={styles.errorAlert} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className={styles.progressContainer}>
            <div className={styles.progressLabel}>
              <span>{statusText}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className={styles.progressBarBg}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* File Dropzone */}
            {!file ? (
              <div 
                className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <UploadCloud size={32} className={styles.dropzoneIcon} />
                <span className={styles.dropzoneText}>Drag & drop file or click to browse</span>
                <span className={styles.dropzoneSub}>Supports bin, rom, hex up to 128MB</span>
              </div>
            ) : (
              <div className={styles.fileInfoCard}>
                <div className={styles.fileDetails}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <File size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span className={styles.fileName}>{file.name}</span>
                  </div>
                  <span className={styles.fileSize}>{formatBytes(file.size)}</span>
                </div>
                <button 
                  type="button" 
                  className={styles.removeFileBtn} 
                  onClick={() => setFile(null)}
                >
                  <X size={18} />
                </button>
              </div>
            )}

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Device Type</label>
                <select 
                  value={deviceType} 
                  onChange={(e) => setDeviceType(e.target.value)}
                >
                  {DEVICE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup} ref={suggestionsRef}>
                <label>Device Model</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. TL-WR841N"
                  value={deviceModel}
                  onChange={(e) => {
                    setDeviceModel(e.target.value);
                    setShowSuggestions(true);
                    setModelMessage('');
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={handleModelBlur}
                  autoComplete="off"
                />
                {showSuggestions && suggestions.length > 0 && (() => {
                  const hasDbMatch = suggestions.some(s => s.source === 'database');
                  return (
                    <ul className={styles.suggestionsList}>
                      {suggestions.map((suggestion, idx) => {
                        const isDisabled = hasDbMatch && suggestion.source === 'internet';
                        return (
                          <li 
                            key={idx} 
                            className={`${styles.suggestionItem} ${isDisabled ? styles.suggestionDisabled : ''}`}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                            onMouseDown={isDisabled ? undefined : () => handleSelectSuggestion(suggestion.name)}
                            title={isDisabled ? "Web results are disabled when a database match exists" : undefined}
                          >
                            <span>{suggestion.name}</span>
                            <span className={`${styles.suggestionSource} ${suggestion.source === 'database' ? styles.sourceDb : styles.sourceWeb}`}>
                              {suggestion.source === 'database' ? 'Database Match' : 'Web Match'}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
                {isCheckingModel && <span style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '2px' }}>Checking model name...</span>}
                {modelMessage && <span style={{ fontSize: '0.74rem', color: '#4ade80', marginTop: '2px' }}>{modelMessage}</span>}
              </div>
            </div>

            {deviceType === 'Other' && (
              <div className={styles.formGroup}>
                <label>Custom Device Type</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. TV Box, Modem"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                />
              </div>
            )}

            <div className={styles.formGroup}>
              <label>Firmware Source (Required)</label>
              <div className={styles.radioGroup}>
                <label className={`${styles.radioLabel} ${isDump === false ? styles.radioLabelActive : ''}`}>
                  <input 
                    type="radio" 
                    name="isDump" 
                    value="false"
                    checked={isDump === false}
                    onChange={() => setIsDump(false)}
                  />
                  Official / Clean Release
                </label>
                <label className={`${styles.radioLabel} ${isDump === true ? styles.radioLabelActive : ''}`}>
                  <input 
                    type="radio" 
                    name="isDump" 
                    value="true"
                    checked={isDump === true}
                    onChange={() => setIsDump(true)}
                  />
                  Dump (Pulled from Device)
                </label>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Firmware Version</label>
              <input 
                type="text" 
                required 
                placeholder="e.g. v1.2.3"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Description / Release Notes (Optional)</label>
              <textarea 
                rows="3" 
                placeholder="Details about fixes, updates or region..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className={styles.submitBtnRow}>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ width: 'auto' }}
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-accent" 
                style={{ width: 'auto' }}
              >
                Start Upload
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}

