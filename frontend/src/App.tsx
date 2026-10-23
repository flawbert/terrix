import React, { useCallback, useEffect, useState } from 'react';
import {
  PlusCircle,
  Search,
  RotateCcw,
  Layers,
  LogIn,
  LogOut,
  Inbox,
  Check,
  XCircle,
  CircleUser,
} from 'lucide-react';
import { LandMap, MapInteractionMode } from './components/LandMap';
import { CreateLandModal } from './components/CreateLandModal';
import { EditLandModal } from './components/EditLandModal';
import { LandDetailsPopup } from './components/LandDetailsPopup';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { apiService, getStoredUser, setStoredUser } from './services/api';
import {
  AuthUser,
  CreateLandLotPayload,
  GeoJsonPolygon,
  LandLot,
  LandStatus,
  Proposal,
  UpdateLandLotPayload,
} from './types/land';
import { formatCurrency, formatDistance } from './utils/formatters';
import { notifyLandLotChange, subscribeToLandLotChanges } from './utils/liveSync';

export const App: React.FC = () => {
  const [lands, setLands] = useState<LandLot[]>([]);
  const [selectedLand, setSelectedLand] = useState<LandLot | null>(null);
  const [mode, setMode] = useState<MapInteractionMode>('VIEW');
  const [satelliteMode, setSatelliteMode] = useState<boolean>(false);

  const [pendingGeometry, setPendingGeometry] = useState<{
    geometry: GeoJsonPolygon;
    areaSqm: number;
  } | null>(null);

  const [activeCircleFilter, setActiveCircleFilter] = useState<{
    centerLon: number;
    centerLat: number;
    radiusMeters: number;
  } | null>(null);

  const [maxPriceFilter, setMaxPriceFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<LandStatus | ''>('');

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredUser());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProposalsInbox, setShowProposalsInbox] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [editingLand, setEditingLand] = useState<LandLot | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);

  const loadAllLands = useCallback(async () => {
    try {
      const data = await apiService.fetchAllLands();
      setLands(data);
    } catch (err: any) {
      setBannerMessage(err.message || 'Could not load land lots.');
    }
  }, []);

  useEffect(() => {
    loadAllLands();
    return subscribeToLandLotChanges(() => {
      if (!activeCircleFilter) {
        loadAllLands();
      }
    });
  }, [loadAllLands, activeCircleFilter]);

  const handlePolygonDrawn = useCallback((geometry: GeoJsonPolygon, areaSqm: number) => {
    setMode('VIEW');
    if (areaSqm < 25) {
      setBannerMessage('The drawn land lot is too small (minimum required area is 25 m²).');
      return;
    }
    if (areaSqm > 50_000_000) {
      setBannerMessage('The drawn land lot exceeds the maximum allowed area of 5,000 ha (50 km²). Please draw a realistic plot.');
      return;
    }
    setPendingGeometry({ geometry, areaSqm });
  }, []);

  const handleCircleDrawn = useCallback(
    async (centerLon: number, centerLat: number, radiusMeters: number) => {
      if (radiusMeters > 50_000) {
        setMode('VIEW');
        setBannerMessage('Search radius cannot exceed 50 km (50,000 m). Please draw a smaller search area.');
        return;
      }
      setActiveCircleFilter({ centerLon, centerLat, radiusMeters });
      try {
        const filtered = await apiService.searchLandsByCircle({
          centerLon,
          centerLat,
          radiusMeters,
          maxPrice: maxPriceFilter ? parseFloat(maxPriceFilter) : undefined,
          status: statusFilter,
        });
        setLands(filtered);
        setSelectedLand(null);
        setBannerMessage(
          `Found ${filtered.length} land lot(s) intersecting the ${formatDistance(radiusMeters)} radius.`
        );
      } catch (err: any) {
        setBannerMessage(err.message || 'Failed to execute spatial circle search.');
      }
    },
    [maxPriceFilter, statusFilter]
  );

  const handleResetSearch = async () => {
    setActiveCircleFilter(null);
    setMaxPriceFilter('');
    setStatusFilter('');
    setMode('VIEW');
    setBannerMessage(null);
    await loadAllLands();
  };

  const handleCreateLandSubmit = async (payload: CreateLandLotPayload) => {
    try {
      const created = await apiService.createLandLot(payload);
      setPendingGeometry(null);
      await loadAllLands();
      notifyLandLotChange();
      setSelectedLand(created);
      setBannerMessage(`Land lot "${created.title}" registered successfully!`);
    } catch (err: any) {
      // Refresh map immediately so any conflicting lot created by another user becomes visible right underneath the modal!
      await loadAllLands();
      throw err;
    }
  };

  const handleUpdateLandStatus = async (id: string, status: LandStatus) => {
    const updated = await apiService.updateLandStatus(id, status);
    setSelectedLand(updated);
    await loadAllLands();
    notifyLandLotChange();
    setBannerMessage(`Land lot "${updated.title}" marked as ${status}.`);
  };

  const handleDeleteLand = async (id: string) => {
    await apiService.deleteLandLot(id);
    setSelectedLand(null);
    await loadAllLands();
    notifyLandLotChange();
    setBannerMessage('Land listing removed.');
  };

  const handleEditLandSubmit = async (id: string, payload: UpdateLandLotPayload) => {
    const updated = await apiService.updateLandLot(id, payload);
    setEditingLand(null);
    setLands((prev) => prev.map((lot) => (lot.id === updated.id ? updated : lot)));
    setSelectedLand((prev) => (prev && prev.id === updated.id ? updated : prev));
    setProfileRefreshKey((k) => k + 1);
    await loadAllLands();
    notifyLandLotChange();
    setBannerMessage(`Land lot "${updated.title}" updated successfully.`);
  };

  const handleViewLandFromProfile = async (landLotId: string) => {
    setShowProfile(false);
    setMode('VIEW');
    const local = lands.find((lot) => lot.id === landLotId);
    if (local) {
      setSelectedLand(local);
      return;
    }
    try {
      setSelectedLand(await apiService.fetchLandById(landLotId));
    } catch (err: any) {
      setBannerMessage(err.message || 'Could not load the selected land lot.');
    }
  };

  const handleOpenInbox = async () => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    try {
      const list = await apiService.fetchReceivedProposals();
      setProposals(list);
      setShowProposalsInbox(true);
    } catch (err: any) {
      setBannerMessage(err.message || 'Could not load proposals.');
    }
  };

  const handleEvaluateProposal = async (proposalId: string, accept: boolean) => {
    await apiService.evaluateProposal(proposalId, accept);
    const updated = await apiService.fetchReceivedProposals();
    setProposals(updated);
    await loadAllLands();
    notifyLandLotChange();
  };

  const displayedLands = lands.filter((lot) => {
    if (statusFilter && lot.status !== statusFilter) return false;
    if (maxPriceFilter && lot.price > parseFloat(maxPriceFilter)) return false;
    return true;
  });

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-slate-950">
      <header className="z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-5 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="/logo-terrix.svg"
            alt="Terrix Logo"
            className="w-10 h-10 rounded-xl object-contain"
          />
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
              TERRIX
            </h1>
            <p className="text-xs text-slate-400">
              Interactive Geospatial Land Marketplace ({displayedLands.length} lots visible)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                setShowAuthModal(true);
                return;
              }
              setSelectedLand(null);
              loadAllLands();
              setMode(mode === 'DRAW_POLYGON' ? 'VIEW' : 'DRAW_POLYGON');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              mode === 'DRAW_POLYGON'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            {mode === 'DRAW_POLYGON' ? 'Drawing Polygon (Click vertices)...' : 'Draw & List Land'}
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedLand(null);
              setMode(mode === 'DRAW_CIRCLE' ? 'VIEW' : 'DRAW_CIRCLE');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              mode === 'DRAW_CIRCLE'
                ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/25'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
            }`}
          >
            <Search className="w-4 h-4" />
            {mode === 'DRAW_CIRCLE' ? 'Drag Mouse to Draw Search Circle...' : 'Circle Radius Search'}
          </button>

          {(activeCircleFilter || maxPriceFilter || statusFilter || mode !== 'VIEW') && (
            <button
              type="button"
              onClick={handleResetSearch}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Map
            </button>
          )}

          <button
            type="button"
            onClick={() => setSatelliteMode(!satelliteMode)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            {satelliteMode ? 'Street Map' : 'Satellite View'}
          </button>

          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LandStatus | '')}
            className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200"
          >
            <option value="">All Statuses</option>
            <option value="AVAILABLE">Available Only</option>
            <option value="RESERVED">Reserved</option>
            <option value="SOLD">Sold</option>
          </select>

          <input
            type="number"
            aria-label="Maximum price filter"
            placeholder="Max Price ($)"
            value={maxPriceFilter}
            onChange={(e) => setMaxPriceFilter(e.target.value)}
            className="w-32 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200"
          />
        </div>

        <div className="flex items-center gap-2">
          {currentUser ? (
            <>
              <button
                type="button"
                onClick={handleOpenInbox}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 flex items-center gap-1.5"
              >
                <Inbox className="w-3.5 h-3.5" />
                Proposals Inbox
              </button>
              <button
                type="button"
                onClick={() => setShowProfile(true)}
                aria-label="Open my profile"
                title="My profile: reservations & listings"
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5"
              >
                <CircleUser className="w-4 h-4 text-sky-400" />
                <span className="hidden sm:inline">{currentUser.name}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStoredUser(null);
                  setCurrentUser(null);
                  setShowProfile(false);
                  setEditingLand(null);
                }}
                aria-label="Sign out"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In / Register
            </button>
          )}
        </div>
      </header>

      {bannerMessage && (
        <div className="z-20 bg-slate-900/90 border-b border-slate-800 px-5 py-2 text-xs text-sky-300 flex items-center justify-between">
          <span>{bannerMessage}</span>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-slate-400 hover:text-white ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      <main className="relative flex-1 w-full h-full">
        <LandMap
          lands={displayedLands}
          mode={mode}
          satelliteMode={satelliteMode}
          selectedLand={selectedLand}
          hasActiveCircle={Boolean(activeCircleFilter)}
          onSelectLand={setSelectedLand}
          onPolygonDrawn={handlePolygonDrawn}
          onCircleDrawn={handleCircleDrawn}
        />

        {selectedLand && (
          <LandDetailsPopup
            land={selectedLand}
            currentUser={currentUser}
            onClose={() => setSelectedLand(null)}
            onDelete={handleDeleteLand}
            onUpdateStatus={handleUpdateLandStatus}
            onEdit={(land) => setEditingLand(land)}
            onSubmitProposal={async (landId, price, msg) => {
              await apiService.submitProposal(landId, price, msg);
              notifyLandLotChange();
            }}
            onRequireAuth={() => setShowAuthModal(true)}
          />
        )}
      </main>

      {pendingGeometry && (
        <CreateLandModal
          geometry={pendingGeometry.geometry}
          estimatedAreaSqm={pendingGeometry.areaSqm}
          onClose={() => setPendingGeometry(null)}
          onSubmit={handleCreateLandSubmit}
        />
      )}

      {showProfile && currentUser && (
        <UserProfileModal
          currentUser={currentUser}
          refreshKey={profileRefreshKey}
          onClose={() => setShowProfile(false)}
          onViewLand={handleViewLandFromProfile}
          onEditLand={(land) => setEditingLand(land)}
        />
      )}

      {editingLand && (
        <EditLandModal
          key={editingLand.id}
          land={editingLand}
          onClose={() => setEditingLand(null)}
          onSubmit={handleEditLandSubmit}
        />
      )}

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={(user) => {
            setCurrentUser(user);
            setShowAuthModal(false);
          }}
        />
      )}

      {showProposalsInbox && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-lg font-bold text-white">Received Purchase Proposals</h2>
              <button
                onClick={() => setShowProposalsInbox(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                Close
              </button>
            </div>
            {proposals.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">
                No purchase proposals received for your land listings yet.
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {proposals.map((prop) => (
                  <div
                    key={prop.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{prop.landLotTitle}</p>
                      <p className="text-xs text-emerald-400 font-semibold">
                        Offer: {formatCurrency(prop.offeredPrice)} — by {prop.buyerName} ({prop.buyerEmail})
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{prop.message}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {prop.status === 'PENDING' ? (
                        <>
                          <button
                            onClick={() => handleEvaluateProposal(prop.id, true)}
                            aria-label="Accept proposal"
                            className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEvaluateProposal(prop.id, false)}
                            aria-label="Reject proposal"
                            className="p-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs font-bold uppercase text-slate-300">
                          {prop.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
