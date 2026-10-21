import React, { useState } from 'react';
import { X, MapPin, DollarSign, Phone, FileText } from 'lucide-react';
import { CreateLandLotPayload, GeoJsonPolygon } from '../types/land';
import { formatArea } from '../utils/formatters';

interface CreateLandModalProps {
  geometry: GeoJsonPolygon;
  estimatedAreaSqm: number;
  onClose: () => void;
  onSubmit: (payload: CreateLandLotPayload) => Promise<void>;
}

export const CreateLandModal: React.FC<CreateLandModalProps> = ({
  geometry,
  estimatedAreaSqm,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      setError('Please enter a valid positive total price.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        title,
        description,
        price: numericPrice,
        contactInfo,
        geometry,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to register land lot.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-400" />
              Register Drawn Land Lot
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Estimated Geodesic Area:{' '}
              <span className="text-emerald-400 font-semibold">
                {formatArea(estimatedAreaSqm)}
              </span>{' '}
              ({geometry.coordinates[0].length - 1} vertices)
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-sm font-medium"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="land-title" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Listing Title
            </label>
            <input
              id="land-title"
              type="text"
              required
              placeholder="e.g., Sunny Valley Agricultural Plot #04"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="land-price" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Total Price (USD)
            </label>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="land-price"
                type="number"
                step="0.01"
                required
                placeholder="250000.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="land-contact" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Seller Contact Information
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="land-contact"
                type="text"
                required
                placeholder="e.g., seller@terrix.io | +1 (555) 234-5678"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="land-description" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Property Description & Soil / Access Details
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <textarea
                id="land-description"
                rows={3}
                required
                placeholder="Describe topography, water resources, road access, and zoning..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition disabled:opacity-50"
            >
              {submitting ? 'Validating Spatial Geometry...' : 'Publish Land Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
