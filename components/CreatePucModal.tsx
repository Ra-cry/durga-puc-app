'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  validateVehicleNo,
  computeValidTillClient,
  formatIST,
  getValidityLabel,
  getTodayISTDateString,
} from '@/lib/clientHelpers';

interface CreatePucModalProps {
  onClose: () => void;
  onSuccess: () => void;
  defaultDate?: string;
}

const BS_STAGES = ['BS1', 'BS2', 'BS3', 'BS4', 'BS6'] as const;
const VEHICLE_CLASS_OPTIONS = ['MC', 'CAR', 'LORRY', 'MMV', 'CUSTOM'] as const;
const FUEL_OPTIONS = [
  { value: 'Petrol', label: 'Petrol (P)', code: 'P' },
  { value: 'Diesel', label: 'Diesel (D)', code: 'D' },
  { value: 'Gas', label: 'Gas (G)', code: 'G' },
] as const;

export default function CreatePucModal({ onClose, onSuccess, defaultDate }: CreatePucModalProps) {
  const [form, setForm] = useState({
    vehicleNo: '',
    vehicleClass: 'CAR',
    customClass: '',
    bsStage: '',
    fuelType: 'Petrol',
    customerName: '',
    customerPhone: '',
    agent: '',
    issuedDate: defaultDate || getTodayISTDateString(),
  });
  const [isCustomClass, setIsCustomClass] = useState(false);
  const [validityPreview, setValidityPreview] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  // Update validity preview whenever bsStage or issuedDate changes
  useEffect(() => {
    if (form.bsStage) {
      const baseDate = form.issuedDate ? new Date(form.issuedDate + 'T12:00:00') : new Date();
      const till = computeValidTillClient(baseDate, form.bsStage);
      setValidityPreview(
        `Valid till: ${formatIST(till)} (${getValidityLabel(form.bsStage)})`
      );
    } else {
      setValidityPreview('');
    }
  }, [form.bsStage, form.issuedDate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (name === 'vehicleNo') {
      formattedValue = value.replace(/[\s-]/g, '').toUpperCase();
    } else if (name === 'customerPhone') {
      formattedValue = value.replace(/\D/g, '');
    } else if (name === 'customClass') {
      formattedValue = value.toUpperCase();
    }

    if (name === 'vehicleClass') {
      if (value === 'CUSTOM') {
        setIsCustomClass(true);
      } else {
        setIsCustomClass(false);
      }
    }

    setForm((prev) => ({
      ...prev,
      [name]: formattedValue,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};

    const cleanVehicle = (form.vehicleNo || '').replace(/[\s-]/g, '').toUpperCase();
    if (!cleanVehicle) {
      newErrors.vehicleNo = 'Vehicle number is required';
    } else if (!validateVehicleNo(cleanVehicle)) {
      newErrors.vehicleNo = 'Invalid format. Expected example: AP03AB1234';
    }

    if (isCustomClass && !form.customClass.trim()) {
      newErrors.customClass = 'Please enter custom vehicle class';
    }

    if (!form.bsStage) newErrors.bsStage = 'BS Stage is required';
    if (!form.fuelType) newErrors.fuelType = 'Fuel type is required';

    const cleanPhone = (form.customerPhone || '').replace(/\D/g, '');
    if (!cleanPhone) {
      newErrors.customerPhone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(cleanPhone)) {
      newErrors.customerPhone = 'Phone must be exactly 10 digits';
    }

    return newErrors;
  }, [form, isCustomClass]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const finalVehicleClass = isCustomClass
      ? form.customClass.trim().toUpperCase() || 'CAR'
      : form.vehicleClass || 'CAR';

    setLoading(true);
    try {
      const res = await fetch('/api/puc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleNo: form.vehicleNo.replace(/[\s-]/g, '').toUpperCase(),
          vehicleClass: finalVehicleClass,
          bsStage: form.bsStage,
          fuelType: form.fuelType,
          customerName: form.customerName.trim() || '—',
          customerPhone: form.customerPhone.replace(/\D/g, ''),
          agent: form.agent.trim() || null,
          issuedDate: form.issuedDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error || 'Failed to create record');
        return;
      }

      onSuccess();
    } catch {
      setServerError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-content glass-card p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white">Create PUC Certificate</h2>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              Fill in the details below to issue a new certificate
            </p>
          </div>
          <button
            id="create-puc-close"
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-slate-800"
            style={{ color: '#64748b' }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <form id="create-puc-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Issue Date & Vehicle No in 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label" htmlFor="puc-issuedDate">
                Issue Date (Calendar) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="puc-issuedDate"
                name="issuedDate"
                type="date"
                className="input-field"
                value={form.issuedDate}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="form-label" htmlFor="puc-vehicleNo">
                Vehicle Number <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="puc-vehicleNo"
                name="vehicleNo"
                type="text"
                className="input-field font-mono font-bold uppercase"
                placeholder="e.g. AP03AB1234"
                value={form.vehicleNo}
                onChange={handleChange}
                maxLength={12}
                autoFocus
                style={errors.vehicleNo ? { borderColor: '#ef4444' } : {}}
              />
              {errors.vehicleNo && (
                <p className="text-xs mt-1" style={{ color: '#f87171' }}>
                  {errors.vehicleNo}
                </p>
              )}
            </div>
          </div>

          {/* Class of Vehicle */}
          <div>
            <label className="form-label" htmlFor="puc-vehicleClass">
              Class of Vehicle <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                id="puc-vehicleClass"
                name="vehicleClass"
                className="select-field"
                value={isCustomClass ? 'CUSTOM' : form.vehicleClass}
                onChange={handleChange}
              >
                <option value="MC">MC (Motorcycle / 2 Wheeler)</option>
                <option value="CAR">CAR (Car / Light Motor Vehicle)</option>
                <option value="LORRY">LORRY (Heavy Goods / Lorry)</option>
                <option value="MMV">MMV (Medium Motor Vehicle)</option>
                <option value="CUSTOM">CUSTOM TO TYPE...</option>
              </select>

              {isCustomClass && (
                <div>
                  <input
                    id="puc-customClass"
                    name="customClass"
                    type="text"
                    className="input-field uppercase font-semibold tracking-wider"
                    placeholder="Type Vehicle Class (e.g. AUTO, BUS)"
                    value={form.customClass}
                    onChange={handleChange}
                    style={errors.customClass ? { borderColor: '#ef4444' } : {}}
                    autoFocus
                  />
                  {errors.customClass && (
                    <p className="text-xs mt-1" style={{ color: '#f87171' }}>
                      {errors.customClass}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* BS Stage + Fuel — two columns */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label" htmlFor="puc-bsStage">
                BS Stage <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                id="puc-bsStage"
                name="bsStage"
                className="select-field"
                value={form.bsStage}
                onChange={handleChange}
                style={errors.bsStage ? { borderColor: '#ef4444' } : {}}
              >
                <option value="">Select BS Stage</option>
                {BS_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.bsStage && (
                <p className="text-xs mt-1" style={{ color: '#f87171' }}>
                  {errors.bsStage}
                </p>
              )}
            </div>

            <div>
              <label className="form-label" htmlFor="puc-fuelType">
                Fuel Type <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                id="puc-fuelType"
                name="fuelType"
                className="select-field"
                value={form.fuelType}
                onChange={handleChange}
                style={errors.fuelType ? { borderColor: '#ef4444' } : {}}
              >
                {FUEL_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              {errors.fuelType && (
                <p className="text-xs mt-1" style={{ color: '#f87171' }}>
                  {errors.fuelType}
                </p>
              )}
            </div>
          </div>

          {/* Validity preview */}
          {validityPreview && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
              style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)',
                color: '#4ade80',
              }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
              {validityPreview}
            </div>
          )}

          {/* Customer Name */}
          <div>
            <label className="form-label" htmlFor="puc-customerName">
              Customer Name{' '}
              <span className="normal-case font-normal" style={{ color: '#475569' }}>
                (optional)
              </span>
            </label>
            <input
              id="puc-customerName"
              name="customerName"
              type="text"
              className="input-field"
              placeholder="Full name (optional)"
              value={form.customerName}
              onChange={handleChange}
            />
          </div>

          {/* Phone + Agent — two columns */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label" htmlFor="puc-customerPhone">
                Phone No <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="puc-customerPhone"
                name="customerPhone"
                type="tel"
                className="input-field"
                placeholder="10-digit number"
                value={form.customerPhone}
                onChange={handleChange}
                maxLength={10}
                style={errors.customerPhone ? { borderColor: '#ef4444' } : {}}
              />
              {errors.customerPhone && (
                <p className="text-xs mt-1" style={{ color: '#f87171' }}>
                  {errors.customerPhone}
                </p>
              )}
            </div>

            <div>
              <label className="form-label" htmlFor="puc-agent">
                Agent{' '}
                <span className="normal-case font-normal" style={{ color: '#475569' }}>
                  (optional)
                </span>
              </label>
              <input
                id="puc-agent"
                name="agent"
                type="text"
                className="input-field"
                placeholder="Agent name"
                value={form.agent}
                onChange={handleChange}
              />
            </div>
          </div>

          {serverError && (
            <div
              className="flex items-center gap-2 p-3 rounded-lg text-sm"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171',
              }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
              {serverError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              id="create-puc-cancel"
              type="button"
              className="btn-secondary flex-1"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              id="create-puc-submit"
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 14, height: 14 }} />
                  Saving...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                  </svg>
                  Issue Certificate
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
