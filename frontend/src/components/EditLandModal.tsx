import React, { useState } from 'react';
import { X, Pencil, DollarSign, Phone, FileText } from 'lucide-react';
import { LandLot, UpdateLandLotPayload } from '../types/land';
import { formatArea } from '../utils/formatters';

interface EditLandModalProps {
  land: LandLot;
  onClose: () => void;
  onSubmit: (id: string, payload: UpdateLandLotPayload) => Promise<void>;
}

/**
 * Modal that lets the owner (advertiser) edit the descriptive data of an existing listing.
 * The polygon geometry and PostGIS-verified area are immutable and shown read-only.
 */
export const EditLandModal: React.FC<EditLandModalProps> = ({ land, onClose, onSubmit }) => {
  const [title, setTitle] = useState(land.title);
  const [price, setPrice] = useState(land.price.toString());
  const [contactInfo, setContactInfo] = useState(land.contactInfo);
  const [description, setDescription] = useState(land.description);
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
    if (!title.trim() || !description.trim() || !contactInfo.trim()) {
      setError('Title, description and contact information cannot be empty.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(land.id, {
        title: title.trim(),
        description: description.trim(),
        price: numericPrice,
        contactInfo: contactInfo.trim(),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to update land lot.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        data-testid="edit-land-modal"
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-400" />
              Edit Land Listing
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Geodesic Area (fixed):{' '}
              <span className="text-emerald-400 font-semibold">{formatArea(land.areaSqMeters)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close edit modal"
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
            <label htmlFor="edit-land-title" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Listing Title
            </label>
            <input
              id="edit-land-title"
              type="text"
              required
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label htmlFor="edit-land-price" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Total Price (USD)
            </label>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="edit-land-price"
                type="number"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-land-contact" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Seller Contact Information
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="edit-land-contact"
                type="text"
                required
                maxLength={150}
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-land-description" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Property Description &amp; Soil / Access Details
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <textarea
                id="edit-land-description"
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
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
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
