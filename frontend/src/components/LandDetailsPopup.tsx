import React, { useState } from 'react';
import {
  X,
  Phone,
  User,
  Maximize2,
  DollarSign,
  Calendar,
  Send,
  Trash2,
  CheckCircle2,
  BadgeCheck,
  RotateCcw,
} from 'lucide-react';
import { AuthUser, LandLot, LandStatus } from '../types/land';
import { formatArea, formatCurrency } from '../utils/formatters';

interface LandDetailsPopupProps {
  land: LandLot;
  currentUser: AuthUser | null;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
  onUpdateStatus?: (id: string, status: LandStatus) => Promise<void>;
  onSubmitProposal: (landId: string, offeredPrice: number, message: string) => Promise<void>;
  onRequireAuth: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  RESERVED: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  SOLD: 'bg-red-500/20 text-red-300 border-red-500/40',
};

export const LandDetailsPopup: React.FC<LandDetailsPopupProps> = ({
  land,
  currentUser,
  onClose,
  onDelete,
  onUpdateStatus,
  onSubmitProposal,
  onRequireAuth,
}) => {
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [offeredPrice, setOfferedPrice] = useState(String(land.price));
  const [message, setMessage] = useState('');
  const [proposalSuccess, setProposalSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isOwner = Boolean(
    currentUser &&
      ((land.ownerId && currentUser.userId === land.ownerId) ||
        (land.ownerName && currentUser.name.toLowerCase() === land.ownerName.toLowerCase()))
  );

  const handleProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numericPrice = parseFloat(offeredPrice);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      setError('Please enter a valid offer amount.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitProposal(land.id, numericPrice, message.trim());
      setProposalSuccess(true);
      setShowProposalForm(false);
    } catch (err: any) {
      setError(err.message || 'Could not submit proposal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <aside
      aria-label="Land Lot Details"
      className="absolute bottom-6 left-6 z-30 w-96 max-w-[calc(100vw-3rem)] bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
    >
      <div className="p-5 border-b border-slate-800 flex items-start justify-between gap-3">
        <div>
          <span
            className={`inline-block text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full border mb-2 ${
              STATUS_BADGE[land.status] || STATUS_BADGE.AVAILABLE
            }`}
          >
            {land.status}
          </span>
          <h3 className="text-lg font-bold text-white leading-snug">{land.title}</h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close details popup"
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Total Price</span>
            </div>
            <p className="text-base font-bold text-emerald-400">{formatCurrency(land.price)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {formatCurrency(land.pricePerSqMeter)} / m²
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Geodesic Area</span>
            </div>
            <p className="text-sm font-bold text-white">{formatArea(land.areaSqMeters)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">PostGIS Verified</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
          {land.description}
        </p>

        <div className="space-y-2 text-xs text-slate-300 pt-1">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium text-white">{land.ownerContact}</span>
          </div>
          {land.ownerName && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Listed by: {land.ownerName}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-slate-400">
            <Calendar className="w-4 h-4 shrink-0" />
            <span>Listed on {new Date(land.createdAt).toLocaleDateString('en-US')}</span>
          </div>
        </div>

        {error && (
          <div role="alert" className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
            {error}
          </div>
        )}

        {proposalSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Purchase proposal sent to the owner!</span>
          </div>
        )}

        {!isOwner && land.status === 'AVAILABLE' && !showProposalForm && (
          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                onRequireAuth();
                return;
              }
              setShowProposalForm(true);
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-sky-500/20"
          >
            <Send className="w-3.5 h-3.5" />
            {currentUser ? 'Make Purchase Offer' : 'Sign In to Make an Offer'}
          </button>
        )}

        {showProposalForm && (
          <form onSubmit={handleProposalSubmit} noValidate className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                Your Offer Price (USD)
              </label>
              <input
                type="number"
                aria-label="Your Offer Price (USD)"
                step="0.01"
                value={offeredPrice}
                onChange={(e) => setOfferedPrice(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                Message to Seller
              </label>
              <textarea
                rows={2}
                aria-label="Message to Seller"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Financing terms, closing timeline, or contact details..."
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowProposalForm(false)}
                className="flex-1 py-2 rounded-lg bg-slate-800 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs"
              >
                {submitting ? 'Sending...' : 'Send Offer'}
              </button>
            </div>
          </form>
        )}

        {isOwner && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            {onUpdateStatus && land.status !== 'SOLD' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(land.id, 'SOLD')}
                className="w-full py-2 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <BadgeCheck className="w-3.5 h-3.5 text-red-400" />
                Mark as Sold (Close Deal)
              </button>
            )}

            {onUpdateStatus && land.status !== 'AVAILABLE' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(land.id, 'AVAILABLE')}
                className="w-full py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                Reopen as Available
              </button>
            )}

            <button
              type="button"
              onClick={() => onDelete(land.id)}
              className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-red-500/20 border border-slate-700 hover:border-red-500/40 text-slate-300 hover:text-red-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove My Listing
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
