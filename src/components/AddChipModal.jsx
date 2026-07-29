'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Cpu, Zap, Check } from 'lucide-react';
import styles from '@/styles/UploadModal.module.css'; // Reuse upload modal styles

export default function AddChipModal({ onClose, onSuccess }) {
  const [category, setCategory] = useState('SPI'); // 'SPI' or 'EC'
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [chipId, setChipId] = useState('');
  const [pageSize, setPageSize] = useState(256);
  const [size, setSize] = useState(4194304); // Default 4MB
  const [spiCommand, setSpiCommand] = useState('SPI25');
  const [protocol, setProtocol] = useState('SPI');
  const [vcc, setVcc] = useState('3.3');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      clearTimeout(timer);
    };
  }, []);

  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
    if (newCat === 'EC') {
      setProtocol('SPI_EC');
      setSpiCommand('KB');
      setPageSize(128);
      setSize(131072); // 128 KB
      setManufacturer('ENE');
      setModel('KB9012');
      setChipId('9012');
    } else {
      setProtocol('SPI');
      setSpiCommand('SPI25');
      setPageSize(256);
      setSize(4194304); // 4 MB
      setManufacturer('');
      setModel('');
      setChipId('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    if (!manufacturer.trim() || !model.trim() || !chipId.trim()) {
      setError('Manufacturer, Model, and Chip ID are required fields.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/chips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          manufacturer: manufacturer.trim(),
          model: model.trim(),
          id: chipId.trim().toUpperCase(),
          pageSize: Number(pageSize),
          size: Number(size),
          spiCommand: category === 'EC' ? 'KB' : spiCommand.trim(),
          protocol: category === 'EC' ? 'SPI_EC' : protocol.trim(),
          vcc: vcc.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit chip.');
      }

      setSuccessMsg(data.message || 'Chip added successfully!');
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred.');
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} ${styles.modalContentAddChip}`}>
        <h3>Submit New Chip to Database</h3>
        <button className={styles.closeBtn} onClick={onClose} disabled={loading}>
          <X size={20} />
        </button>

        {error && (
          <div className={styles.errorAlert}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className={styles.successAlert}>
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Card Category Selector (No Radio Buttons) */}
          <div className={styles.formGroup} style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontWeight: '600', marginBottom: '0.6rem', display: 'block', color: '#e2e8f0', fontSize: '0.9rem' }}>
              Select Chip Type / Category:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              {/* SPI Option Card */}
              <div
                onClick={() => handleCategoryChange('SPI')}
                style={{
                  cursor: 'pointer',
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  border: category === 'SPI' ? '2px solid #38bdf8' : '1.5px solid rgba(255, 255, 255, 0.12)',
                  backgroundColor: category === 'SPI' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Zap size={20} color={category === 'SPI' ? '#38bdf8' : '#94a3b8'} />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.92rem', color: category === 'SPI' ? '#ffffff' : '#cbd5e1' }}>
                      SPI / EEPROM Flash
                    </div>
                    <div style={{ fontSize: '0.75rem', color: category === 'SPI' ? '#93c5fd' : '#64748b' }}>
                      Standard BIOS & Serial Flash
                    </div>
                  </div>
                </div>
                {category === 'SPI' && (
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Check size={13} color="#0f172a" strokeWidth={3} />
                  </div>
                )}
              </div>

              {/* EC Option Card */}
              <div
                onClick={() => handleCategoryChange('EC')}
                style={{
                  cursor: 'pointer',
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  border: category === 'EC' ? '2px solid #a855f7' : '1.5px solid rgba(255, 255, 255, 0.12)',
                  backgroundColor: category === 'EC' ? 'rgba(168, 85, 247, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Cpu size={20} color={category === 'EC' ? '#c084fc' : '#94a3b8'} />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.92rem', color: category === 'EC' ? '#ffffff' : '#cbd5e1' }}>
                      EC Controller
                    </div>
                    <div style={{ fontSize: '0.75rem', color: category === 'EC' ? '#e9d5ff' : '#64748b' }}>
                      ENE, ITE, Nuvoton SIO Chips
                    </div>
                  </div>
                </div>
                {category === 'EC' && (
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#c084fc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Check size={13} color="#0f172a" strokeWidth={3} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Manufacturer (Required)</label>
              <input
                type="text"
                required
                placeholder={category === 'EC' ? "e.g. ENE, ITE, Nuvoton" : "e.g. Winbond, Macronix"}
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Model (Required)</label>
              <input
                type="text"
                required
                placeholder={category === 'EC' ? "e.g. KB9012, IT8586" : "e.g. W25Q32BV, MX25L6405"}
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Chip ID (Hex / Model ID) (Required)</label>
              <input
                type="text"
                required
                placeholder={category === 'EC' ? "e.g. 9012, IT8586" : "e.g. EF4016, C22017"}
                value={chipId}
                onChange={(e) => setChipId(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label>VCC Voltage (V)</label>
              <input
                type="text"
                required
                placeholder="e.g. 3.3, 1.8"
                value={vcc}
                onChange={(e) => setVcc(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Memory Size (Bytes)</label>
              <input
                type="number"
                required
                placeholder={category === 'EC' ? "e.g. 131072" : "e.g. 4194304"}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              />
              <span className={styles.helpText}>
                {category === 'EC'
                  ? "128KB = 131,072 | 256KB = 262,144 | 512KB = 524,288"
                  : "4MB = 4,194,304 | 8MB = 8,388,608 | 16MB = 16,777,216"}
              </span>
            </div>
            <div className={styles.formGroup}>
              <label>Page Size (Bytes)</label>
              <input
                type="number"
                required
                placeholder={category === 'EC' ? "e.g. 128" : "e.g. 256"}
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Protocol</label>
              {category === 'EC' ? (
                <select value="SPI_EC" disabled>
                  <option value="SPI_EC">SPI_EC (EDI / ISP Protocol)</option>
                </select>
              ) : (
                <select value={protocol} onChange={(e) => setProtocol(e.target.value)}>
                  <option value="SPI">SPI</option>
                  <option value="I2C">I2C</option>
                  <option value="Microwire">Microwire</option>
                  <option value="SPI_NAND">SPI NAND</option>
                  <option value="SPI_DATA_45">SPI Data 45</option>
                </select>
              )}
            </div>
            <div className={styles.formGroup}>
              <label>Command Mode</label>
              {category === 'EC' ? (
                <input
                  type="text"
                  disabled
                  value="KB (Keyboard / EC Protocol)"
                />
              ) : (
                <input
                  type="text"
                  required
                  placeholder="e.g. SPI25, SPI45"
                  value={spiCommand}
                  onChange={(e) => setSpiCommand(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className={`${styles.submitBtnRow} ${styles.submitBtnRowLarge}`}>
            <button
              type="button"
              className={`btn btn-ghost ${styles.btnAuto}`}
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn btn-accent ${styles.btnAuto}`}
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Chip'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
