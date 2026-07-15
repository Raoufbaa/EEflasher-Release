'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UploadCloud, File, AlertTriangle, CheckCircle } from 'lucide-react';
import styles from '@/styles/UploadModal.module.css';

const DEVICE_TYPES = ['Receiver', 'Router', 'TV', 'TV Box', 'Desktop BIOS', 'Laptop BIOS', 'EC Firmware', 'EEPROM Dump', 'Automotive', 'Printer', 'Other'];

function formatModelName(name) {
  if (!name) return '';
  let formatted = name.toUpperCase().trim();
  // Insert hyphen between letters and digits (e.g. HG532 -> HG-532)
  formatted = formatted.replace(/([A-Z]+)(?=\d)/g, '$1-');
  return formatted;
}

const genericBlocklist = ['router', 'tv', 'box', 'receiver', 'bios', 'firmware', 'dump', 'device', 'printer', 'automotive', 'pc', 'ec'];
const brands = ['huawei', 'tplink', 'tp-link', 'dlink', 'd-link', 'asus', 'netgear', 'linksys', 'tenda', 'mercusys', 'totolink', 'xiaomi', 'zte', 'cisco', 'belkin', 'ubiquiti', 'mikrotik', 'samsung', 'lg', 'sony', 'panasonic'];

function isValidModelName(name) {
  if (!name) return false;
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();

  // 1. Must contain at least one digit
  if (!/\d/.test(clean)) {
    return false;
  }

  // 2. Remove all brand names and generic words
  let remaining = clean;
  brands.forEach(brand => {
    const regex = new RegExp(`\\b${brand.replace('-', '')}\\b|\\b${brand}\\b`, 'gi');
    remaining = remaining.replace(regex, '');
  });
  genericBlocklist.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    remaining = remaining.replace(regex, '');
  });

  const finalCheck = remaining.replace(/\s+/g, '').trim();
  if (finalCheck.length < 2) {
    return false;
  }

  return true;
}


export default function UploadModal({ onClose, onSuccess, initialData = null }) {
  const [file, setFile] = useState(null);
  const [preUploadedFileKey, setPreUploadedFileKey] = useState(initialData?.fileKey || null);
  const [deviceModel, setDeviceModel] = useState(initialData?.deviceModel || '');
  const [deviceType, setDeviceType] = useState(initialData?.deviceType || (initialData ? 'EEPROM Dump' : 'Receiver'));
  const [customType, setCustomType] = useState('');
  const [version, setVersion] = useState(initialData ? '1.0.0' : '');
  const [description, setDescription] = useState(initialData ? `Firmware dump for ${initialData.deviceModel}` : '');
  const [dragActive, setDragActive] = useState(false);

  const [isUnknownVersion, setIsUnknownVersion] = useState(initialData ? true : false);
  const [isDump, setIsDump] = useState(initialData ? true : false); // default to false, or true if initialData is provided
  const [isCheckingModel, setIsCheckingModel] = useState(false);
  const [isNewModel, setIsNewModel] = useState(false);
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
    const timer = setTimeout(() => setMounted(true), 0);
    // Lock body scroll when modal is active
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (initialData?.deviceModel) {
      const initCheck = async () => {
        const localFormatted = formatModelName(initialData.deviceModel);
        if (!isValidModelName(localFormatted)) return;
        setIsCheckingModel(true);
        try {
          const res = await fetch(`/api/firmware/check-model?model=${encodeURIComponent(localFormatted)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.exists) {
              setDeviceModel(formatModelName(data.recommendedName));
              setModelMessage(data.isApproved ? 'Matched existing device model.' : 'Matched existing pending model.');
              setIsNewModel(false);
            } else {
              setIsNewModel(true);
              setModelMessage('');
            }
          }
        } catch (err) {
          console.warn('Failed to pre-check model:', err);
        } finally {
          setIsCheckingModel(false);
        }
      };
      initCheck();
    }
  }, [initialData]);

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
      const timer = setTimeout(() => {
        setSuggestions([]);
      }, 0);
      return () => clearTimeout(timer);
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
    setIsNewModel(false);
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

    if (!isValidModelName(localFormatted)) {
      setModelMessage('');
      setIsNewModel(false);
      return;
    }

    setIsCheckingModel(true);
    setModelMessage('');
    setIsNewModel(false);
    try {
      const res = await fetch(`/api/firmware/check-model?model=${encodeURIComponent(localFormatted)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.exists) {
          setDeviceModel(formatModelName(data.recommendedName));
          setModelMessage(data.isApproved ? 'Matched existing device model.' : 'Matched existing pending model.');
          setIsNewModel(false);
        } else {
          setIsNewModel(true);
          setModelMessage('');
        }
      }
    } catch (err) {
      console.warn('Failed to check model:', err);
    } finally {
      setIsCheckingModel(false);
    }
  };

  const handleUnknownVersionChange = (e) => {
    const checked = e.target.checked;
    setIsUnknownVersion(checked);
    if (checked) {
      setVersion('Unknown');
    } else {
      setVersion('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!preUploadedFileKey && !file) {
      setError('Please select a firmware file first.');
      return;
    }

    if (!isValidModelName(deviceModel)) {
      setError('Invalid model name. Please enter a specific alphanumeric model number (e.g. TL-WR841N) rather than a generic device type name.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let finalFileKey = preUploadedFileKey;
      let finalFileName = file ? file.name : initialData.fileName;
      let finalFileSize = file ? file.size : initialData.fileSize;
      let finalChecksum = initialData?.checksum;

      if (!preUploadedFileKey) {
        setStatusText('Initializing upload...');
        
        // 1. Calculate SHA-256 Checksum
        const isMatchingDesktopFile = initialData && 
          file.name === initialData.fileName && 
          file.size === initialData.fileSize;
        
        finalChecksum = isMatchingDesktopFile && initialData.checksum
          ? initialData.checksum
          : await calculateChecksum(file);

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
        finalFileKey = file_key;

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
      }

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
          file_key: finalFileKey,
          file_name: finalFileName,
          file_size: finalFileSize,
          checksum: finalChecksum,
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
          <div className={styles.errorAlert}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {initialData && !file && !preUploadedFileKey && (
          <div style={{
            background: 'rgba(74, 158, 255, 0.1)',
            border: '1px solid rgba(74, 158, 255, 0.3)',
            borderRadius: '4px',
            padding: '10px 12px',
            marginBottom: '15px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            color: '#4a9eff'
          }}>
            <File size={18} style={{ flexShrink: 0 }} />
            <span>
              <strong>Autofilled from Desktop:</strong> Please select or drag the file <strong>{initialData.fileName}</strong> ({(initialData.fileSize / 1024 / 1024).toFixed(2)} MB) to complete the upload.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* File Dropzone or Pre-Uploaded Status */}
          {preUploadedFileKey ? (
            <div className={styles.fileInfoCard} style={{ borderColor: '#4caf50', background: 'rgba(76, 175, 80, 0.05)' }}>
              <div className={styles.fileDetails}>
                <div className={styles.fileCardNameRow}>
                  <CheckCircle size={18} style={{ color: '#4caf50', marginRight: '6px', flexShrink: 0 }} />
                  <span className={styles.fileName}>{initialData.fileName}</span>
                </div>
                <span className={styles.fileSize} style={{ color: '#4caf50', fontSize: '12px', display: 'block', marginTop: '2px' }}>
                  {formatBytes(initialData.fileSize)} — Streamed directly from EEFlasher Desktop App
                </span>
              </div>
              {!loading && (
                <button
                  type="button"
                  className={styles.removeFileBtn}
                  onClick={() => setPreUploadedFileKey(null)}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          ) : !file ? (
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
                className={styles.fileInputHidden}
                onChange={handleFileChange}
              />
              <UploadCloud size={32} className={styles.dropzoneIcon} />
              <span className={styles.dropzoneText}>Drag & drop file or click to browse</span>
              <span className={styles.dropzoneSub}>Supports bin, rom, hex up to 128MB</span>
            </div>
          ) : (
            <div className={styles.fileInfoCard}>
              <div className={styles.fileDetails}>
                <div className={styles.fileCardNameRow}>
                  <File size={16} className={styles.fileIcon} />
                  <span className={styles.fileName}>{file.name}</span>
                </div>
                <span className={styles.fileSize}>{formatBytes(file.size)}</span>
              </div>
              {!loading && (
                <button
                  type="button"
                  className={styles.removeFileBtn}
                  onClick={() => setFile(null)}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          )}

          {!loading && (
            <>
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
                      setIsNewModel(false);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={handleModelBlur}
                    autoComplete="off"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <ul className={styles.suggestionsList}>
                      {suggestions.map((suggestion, idx) => (
                        <li
                          key={idx}
                          className={styles.suggestionItem}
                          onMouseDown={() => handleSelectSuggestion(suggestion.name)}
                        >
                          <span>{suggestion.name}</span>
                          <span className={`${styles.suggestionSource} ${styles.sourceDb}`}>
                            Database Match
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {isCheckingModel && <span className={styles.checkingText}>Checking model name...</span>}
                  {modelMessage && <span className={styles.modelSuccessText}>{modelMessage}</span>}
                </div>
              </div>
              {isNewModel && (
                <div className={styles.warningBox}>
                  <AlertTriangle size={14} className={styles.warningBoxIcon} />
                  <span className={styles.warningBoxText}>
                    <strong>New Model:</strong> This device model is not in our database. It will require admin review before becoming public.
                  </span>
                </div>
              )}
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
                <div className={styles.versionInputRow}>
                  <input
                    type="text"
                    required={!isUnknownVersion}
                    disabled={isUnknownVersion}
                    placeholder={isUnknownVersion ? "Unknown" : "e.g. v1.2.3"}
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                  />
                  <label className={`${styles.unknownToggle} ${isUnknownVersion ? styles.unknownToggleChecked : ''}`}>
                    <input
                      type="checkbox"
                      checked={isUnknownVersion}
                      onChange={handleUnknownVersionChange}
                    />
                    <span>Unknown</span>
                  </label>
                </div>
              </div>
              {isUnknownVersion && (
                <div className={styles.warningBox}>
                  <AlertTriangle size={14} className={styles.warningBoxIcon} />
                  <span className={styles.warningBoxText}>
                    <strong>Unknown Version:</strong> Double check that this firmware works great for this model.
                  </span>
                </div>
              )}

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
                  className={`btn btn-ghost ${styles.btnAuto}`}
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn btn-accent ${styles.btnAuto}`}
                >
                  Start Upload
                </button>
              </div>
            </>
          )}

          {loading && (
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
          )}
        </form>
      </div>
    </div>,
    document.body
  );
}

