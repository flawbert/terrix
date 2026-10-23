import React, { useState } from 'react';
import { X, Phone, User, Calendar, DollarSign, Maximize2, Send, Trash2, BadgeCheck, RotateCcw, Pencil } from 'lucide-react';
import { AuthUser, LandLot, LandStatus } from '../types/land';
import { formatArea, formatCurrency } from '../utils/formatters';

interface LandDetailsPopupProps {
  land: LandLot;
  currentUser: AuthUser | null;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
  onUpdateStatus?: (id: string, status: LandStatus) => Promise<void>;
  onEdit?: (land: LandLot) => void;
  onSubmitProposal: (landId: string, offeredPrice: number, message: string) => Promise<void>;
  onRequireAuth: () => void;
}

export const LandDetailsPopup: React.FC<LandDetailsPopupProps> = ({
  land,
  currentUser,
  onClose,
  onDelete,
  onUpdateStatus,
  onEdit,
  onSubmitProposal,
  onRequireAuth,
}) => {
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [offeredPrice, setOfferedPrice] = useState(land.price.toString());
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwner = currentUser && currentUser.userId === land.ownerId;

  const handleProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    try {
      await onSubmitProposal(land.id, parseFloat(offeredPrice), message);
      setFeedback('Purchase proposal sent successfully to the landowner!');
      setShowProposalForm(false);
    } catch (err: any) {
      setError(err.message || 'Could not submit proposal.');
    }
  };

  return (
    <div
      data-testid="land-details-popup"
      className="absolute bottom-6 left-6 z-30 w-96 max-w-[calc(100vw-3rem)] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl p-5 shadow-2xl text-slate-100"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <span
            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider mb-1.5 ${
              land.status === 'AVAILABLE'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : land.status === 'RESERVED'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-red-500/20 text-red-300 border border-red-500/40'
            }`}
          >
            {land.status}
          </span>
          <h3 className="text-lg font-bold text-white leading-snug">{land.title}</h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close popup"
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 my-4">
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Total Price
          </span>
          <p className="text-base font-bold text-emerald-400 mt-0.5">
            {formatCurrency(land.price)}
          </p>
          <span className="text-[11px] text-slate-400">
            {formatCurrency(land.pricePerSqMeter)} / m²
          </span>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Maximize2 className="w-3.5 h-3.5 text-sky-400" /> Geodesic Area
          </span>
          <p className="text-sm font-bold text-white mt-0.5">
            {formatArea(land.areaSqMeters)}
          </p>
          <span className="text-[11px] text-slate-400">PostGIS Verified</span>
        </div>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed mb-4">{land.description}</p>

      <div className="space-y-2 text-xs text-slate-300 border-t border-slate-800 pt-3">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium text-white">{land.contactInfo}</span>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-sky-400 shrink-0" />
          <span>Listed by: {land.ownerName}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Calendar className="w-4 h-4 shrink-0" />
          <span>Listed on {new Date(land.createdAt).toLocaleDateString('en-US')}</span>
        </div>
      </div>

      {feedback && (
        <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs">
          {feedback}
        </div>
      )}

      {error && (
        <div className="mt-3 p-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Action Buttons: Negotiate Proposal or Owner Delete */}
      <div
        className={`mt-4 pt-3 border-t border-slate-800 gap-2 ${
          isOwner ? 'grid grid-cols-2' : 'flex items-center justify-between'
        }`}
      >
        {land.status === 'AVAILABLE' && !isOwner && (
          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                onRequireAuth();
              } else {
                setShowProposalForm(!showProposalForm);
              }
            }}
            className="w-full py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
          >
            <Send className="w-3.5 h-3.5" />
            {currentUser ? 'Make Purchase Offer' : 'Sign In to Make an Offer'}
          </button>
        )}

        {isOwner && onUpdateStatus && land.status !== 'SOLD' && (
          <button
            type="button"
            onClick={() => onUpdateStatus(land.id, 'SOLD')}
            className="w-full py-2 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <BadgeCheck className="w-4 h-4 shrink-0" />
            <span>Mark as Sold (Close Deal)</span>
          </button>
        )}

        {isOwner && onUpdateStatus && land.status !== 'AVAILABLE' && (
          <button
            type="button"
            onClick={() => onUpdateStatus(land.id, 'AVAILABLE')}
            className="w-full py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>Reopen as Available</span>
          </button>
        )}

        {isOwner && onEdit && land.status !== 'SOLD' && (
          <button
            type="button"
            onClick={() => onEdit(land)}
            className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <Pencil className="w-3.5 h-3.5 shrink-0" />
            <span>Edit Listing</span>
          </button>
        )}

        {isOwner && (
          <button
            type="button"
            onClick={() => onDelete(land.id)}
            className="w-full py-2 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove My Listing
          </button>
        )}
      </div>

      {showProposalForm && (
        <form onSubmit={handleProposalSubmit} className="mt-3 pt-3 border-t border-slate-800 space-y-2.5">
          <div>
            <label htmlFor="offer-price" className="block text-[11px] font-semibold text-slate-300 mb-1">
              Your Offered Price (USD)
            </label>
            <input
              id="offer-price"
              type="number"
              step="0.01"
              required
              value={offeredPrice}
              onChange={(e) => setOfferedPrice(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
            />
          </div>
          <div>
            <label htmlFor="offer-msg" className="block text-[11px] font-semibold text-slate-300 mb-1">
              Message / Payment Terms
            </label>
            <textarea
              id="offer-msg"
              rows={2}
              required
              placeholder="e.g., Cash payment within 15 days..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
          >
            Submit Formal Proposal
          </button>
        </form>
      )}
    </div>
  );
};
