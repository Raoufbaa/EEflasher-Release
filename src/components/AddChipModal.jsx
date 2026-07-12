'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Cpu, AlertTriangle } from 'lucide-react';
import styles from '@/styles/UploadModal.module.css'; // Reuse upload modal styles

export default function AddChipModal({ onClose, onSuccess }) {
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
          manufacturer: manufacturer.trim(),
          model: model.trim(),
          id: chipId.trim().toUpperCase(),
          pageSize: Number(pageSize),
          size: Number(size),
          spiCommand: spiCommand.trim(),
          protocol: protocol.trim(),
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
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Manufacturer (Required)</label>
              <input
                type="text"
                required
                placeholder="e.g. Winbond, Macronix"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Model (Required)</label>
              <input
                type="text"
                required
                placeholder="e.g. W25Q32BV, MX25L6405"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Chip ID (Hex) (Required)</label>
              <input
                type="text"
                required
                placeholder="e.g. EF4016, C22017"
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
                placeholder="e.g. 4194304"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              />
              <span className={styles.helpText}>
                4MB = 4,194,304 | 8MB = 8,388,608 | 16MB = 16,777,216
              </span>
            </div>
            <div className={styles.formGroup}>
              <label>Page Size (Bytes)</label>
              <input
                type="number"
                required
                placeholder="e.g. 256"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Protocol</label>
              <select value={protocol} onChange={(e) => setProtocol(e.target.value)}>
                <option value="SPI">SPI</option>
                <option value="I2C">I2C</option>
                <option value="Microwire">Microwire</option>
                <option value="OWI">One-Wire</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>SPI Command Mode</label>
              <input
                type="text"
                required
                placeholder="e.g. SPI25, I2C_24xx"
                value={spiCommand}
                onChange={(e) => setSpiCommand(e.target.value)}
              />
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
