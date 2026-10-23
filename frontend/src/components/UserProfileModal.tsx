import React, { useEffect, useState } from 'react';
import { X, CircleUser, Bookmark, MapPinned, Eye, Pencil } from 'lucide-react';
import { AuthUser, LandLot, LandStatus, Proposal, ProposalStatus } from '../types/land';
import { apiService } from '../services/api';
import { formatArea, formatCurrency } from '../utils/formatters';

type ProfileTab = 'RESERVATIONS' | 'LISTINGS';

interface UserProfileModalProps {
  currentUser: AuthUser;
  onClose: () => void;
  /** Focus a land lot on the map (closes the profile pop-up). */
  onViewLand: (landLotId: string) => void;
  /** Open the edit modal for one of the user's own listings. */
  onEditLand: (land: LandLot) => void;
  /** Changes whenever lots are modified elsewhere, forcing a reload of the profile data. */
  refreshKey?: number;
}

const landStatusClasses: Record<LandStatus, string> = {
  AVAILABLE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  RESERVED: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  SOLD: 'bg-red-500/20 text-red-300 border-red-500/40',
};

const proposalStatusLabel: Record<ProposalStatus, { label: string; classes: string }> = {
  PENDING: { label: 'Awaiting owner', classes: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  ACCEPTED: { label: 'Reserved for you', classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  REJECTED: { label: 'Rejected', classes: 'bg-red-500/20 text-red-300 border-red-500/40' },
};

const Badge: React.FC<{ classes: string; children: React.ReactNode }> = ({ classes, children }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${classes}`}>
    {children}
  </span>
);

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  currentUser,
  onClose,
  onViewLand,
  onEditLand,
  refreshKey = 0,
}) => {
  const [tab, setTab] = useState<ProfileTab>('RESERVATIONS');
  const [myProposals, setMyProposals] = useState<Proposal[]>([]);
  const [myLands, setMyLands] = useState<LandLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([apiService.fetchMyProposals(), apiService.fetchMyLands()])
      .then(([proposals, lands]) => {
        if (cancelled) return;
        setMyProposals(proposals);
        setMyLands(lands);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || 'Could not load your profile data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const reservedCount = myProposals.filter((p) => p.status === 'ACCEPTED').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-label="My profile"
        data-testid="user-profile-modal"
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
              <CircleUser className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{currentUser.name}</h2>
              <p className="text-xs text-slate-400">{currentUser.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close profile"
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 mb-4" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'RESERVATIONS'}
            onClick={() => setTab('RESERVATIONS')}
            className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
              tab === 'RESERVATIONS'
                ? 'bg-sky-500 text-slate-950 border-sky-500'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            My Reservations ({myProposals.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'LISTINGS'}
            onClick={() => setTab('LISTINGS')}
            className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
              tab === 'LISTINGS'
                ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <MapPinned className="w-3.5 h-3.5" />
            My Listings ({myLands.length})
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-3 p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Loading your profile...</p>
        ) : tab === 'RESERVATIONS' ? (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {myProposals.length > 0 && (
              <p className="text-[11px] text-slate-400">
                {reservedCount} lot(s) reserved for you · {myProposals.length} reservation request(s) in total
              </p>
            )}
            {myProposals.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">
                You have not requested any land lot reservation yet.
              </p>
            ) : (
              myProposals.map((prop) => {
                const status = proposalStatusLabel[prop.status];
                return (
                  <div
                    key={prop.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge classes={status.classes}>{status.label}</Badge>
                        <span className="text-[11px] text-slate-500">
                          {new Date(prop.createdAt).toLocaleDateString('en-US')}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-white truncate">{prop.landLotTitle}</p>
                      <p className="text-xs text-emerald-400 font-semibold">
                        Your offer: {formatCurrency(prop.offeredPrice)}
                        {prop.landLotPrice !== undefined && (
                          <span className="text-slate-400 font-normal">
                            {' '}· Asking price: {formatCurrency(prop.landLotPrice)}
                          </span>
                        )}
                      </p>
                      {prop.message && <p className="text-xs text-slate-400 mt-1 truncate">{prop.message}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => onViewLand(prop.landLotId)}
                      aria-label={`View ${prop.landLotTitle} on map`}
                      className="shrink-0 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {myLands.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">You have not listed any land lot yet.</p>
            ) : (
              myLands.map((lot) => (
                <div
                  key={lot.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge classes={landStatusClasses[lot.status]}>{lot.status}</Badge>
                      <span className="text-[11px] text-slate-500">
                        Listed on {new Date(lot.createdAt).toLocaleDateString('en-US')}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white truncate">{lot.title}</p>
                    <p className="text-xs text-emerald-400 font-semibold">
                      {formatCurrency(lot.price)}
                      <span className="text-slate-400 font-normal"> · {formatArea(lot.areaSqMeters)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lot.status !== 'SOLD' && (
                      <button
                        type="button"
                        onClick={() => onEditLand(lot)}
                        aria-label={`Edit ${lot.title}`}
                        className="p-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onViewLand(lot.id)}
                      aria-label={`View ${lot.title} on map`}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
