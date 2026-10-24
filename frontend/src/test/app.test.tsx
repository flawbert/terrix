import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { formatArea, formatCurrency, formatDistance } from '../utils/formatters';
import { apiService, getStoredUser, setStoredUser } from '../services/api';
import { CreateLandModal } from '../components/CreateLandModal';
import { AuthModal } from '../components/AuthModal';
import { LandDetailsPopup } from '../components/LandDetailsPopup';
import { EditLandModal } from '../components/EditLandModal';
import { UserProfileModal } from '../components/UserProfileModal';
import { App } from '../App';
import { LandLot, Proposal } from '../types/land';

const sampleLot: LandLot = {
  id: 'lot-123',
  title: 'Golden Valley Plot',
  description: 'Flat agricultural land with river access.',
  price: 250000,
  areaSqMeters: 15000,
  pricePerSqMeter: 16.67,
  contactInfo: 'seller@terrix.io',
  status: 'AVAILABLE',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-47.0626, -22.9056],
        [-47.0616, -22.9056],
        [-47.0616, -22.9046],
        [-47.0626, -22.9046],
        [-47.0626, -22.9056],
      ],
    ],
  },
  ownerId: 'owner-1',
  ownerName: 'Alice Farmer',
  createdAt: '2026-10-19T12:00:00Z',
};

const sampleProposal: Proposal = {
  id: 'prop-1',
  landLotId: 'lot-123',
  landLotTitle: 'Golden Valley Plot',
  buyerId: 'buyer-2',
  buyerName: 'Bob Buyer',
  buyerEmail: 'bob@terrix.io',
  offeredPrice: 240000,
  message: 'Cash payment',
  status: 'PENDING',
  createdAt: '2026-10-19T13:00:00Z',
};

describe('Formatters Utility Tests', () => {
  it('formats currency, area and distance accurately', () => {
    expect(formatCurrency(250000)).toBe('$250,000.00');
    expect(formatArea(0)).toBe('0 m²');
    expect(formatArea(500)).toBe('500 m²');
    expect(formatArea(15000)).toContain('1.50 ha');
    expect(formatDistance(-5)).toBe('0 m');
    expect(formatDistance(450)).toBe('450 m');
    expect(formatDistance(1500)).toContain('1.50 km');
  });
});

describe('API Service & LocalStorage Auth Tests', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('stores, retrieves and handles malformed sessionStorage user data', () => {
    expect(getStoredUser()).toBeNull();
    const user = { token: 'jwt-1', userId: 'u-1', name: 'Bob', email: 'bob@terrix.io' };
    setStoredUser(user);
    expect(getStoredUser()?.email).toBe('bob@terrix.io');
    setStoredUser(null);
    expect(getStoredUser()).toBeNull();

    sessionStorage.setItem('terrix_auth_user', '{invalid-json');
    expect(getStoredUser()).toBeNull();
  });

  it('calls backend endpoints and handles HTTP responses and errors', async () => {
    setStoredUser({ token: 'jwt-token', userId: 'u-1', name: 'Bob', email: 'bob@terrix.io' });

    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [sampleLot],
    });
    expect(await apiService.fetchAllLands()).toHaveLength(1);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [sampleLot],
    });
    expect(
      await apiService.searchLandsByCircle({
        centerLon: -47.06,
        centerLat: -22.9,
        radiusMeters: 500,
        maxPrice: 300000,
        status: 'AVAILABLE',
      })
    ).toHaveLength(1);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => sampleLot,
    });
    const created = await apiService.createLandLot({
      title: sampleLot.title,
      description: sampleLot.description,
      price: sampleLot.price,
      contactInfo: sampleLot.contactInfo,
      geometry: sampleLot.geometry,
    });
    expect(created.id).toBe('lot-123');

    fetchMock.mockResolvedValueOnce({ ok: true, status: 204 });
    await apiService.deleteLandLot('lot-123');

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ detail: 'Spatial overlap detected' }),
    });
    await expect(
      apiService.createLandLot({
        title: 'Overlap',
        description: 'Desc',
        price: 100,
        contactInfo: 'c',
        geometry: sampleLot.geometry,
      })
    ).rejects.toThrow('Spatial overlap detected');

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ title: 'Bad Request Title' }),
    });
    await expect(apiService.fetchAllLands()).rejects.toThrow('Bad Request Title');
  });

  it('handles auth and proposal API calls', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ token: 't', userId: 'u1', name: 'N', email: 'e@terrix.io' }),
    });
    expect((await apiService.register('N', 'e@terrix.io', '123456')).email).toBe('e@terrix.io');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ token: 't', userId: 'u1', name: 'N', email: 'e@terrix.io' }),
    });
    expect((await apiService.login('e@terrix.io', '123456')).token).toBe('t');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 'p1', status: 'PENDING' }),
    });
    expect((await apiService.submitProposal('lot-123', 200000, 'Offer')).id).toBe('p1');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [sampleProposal],
    });
    expect(await apiService.fetchReceivedProposals()).toHaveLength(1);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'p1', status: 'ACCEPTED' }),
    });
    expect((await apiService.evaluateProposal('p1', true)).status).toBe('ACCEPTED');
  });
});

describe('UI Modals & Components Tests', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders CreateLandModal, validates invalid price and handles submission errors', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error('Overlap conflict'))
      .mockResolvedValueOnce(undefined);
    const onClose = vi.fn();

    render(
      <CreateLandModal
        geometry={sampleLot.geometry}
        estimatedAreaSqm={15000}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText(/Listing Title/i), { target: { value: 'New Farm' } });
    fireEvent.change(screen.getByLabelText(/Total Price/i), { target: { value: '-10' } });
    fireEvent.change(screen.getByLabelText(/Seller Contact/i), { target: { value: '555-0199' } });
    fireEvent.change(screen.getByLabelText(/Property Description/i), { target: { value: 'Rich soil' } });

    fireEvent.click(screen.getByText(/Publish Land Listing/i));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid positive total price/i);

    fireEvent.change(screen.getByLabelText(/Total Price/i), { target: { value: '180000' } });
    fireEvent.click(screen.getByText(/Publish Land Listing/i));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Overlap conflict/i);

    fireEvent.click(screen.getByText(/Publish Land Listing/i));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(2);
    });
  });

  it('renders LandDetailsPopup for buyer, guest and owner flows', async () => {
    const onSubmitProposal = vi
      .fn()
      .mockRejectedValueOnce(new Error('Proposal error'))
      .mockResolvedValueOnce(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onRequireAuth = vi.fn();

    const { rerender } = render(
      <LandDetailsPopup
        land={sampleLot}
        currentUser={null}
        onClose={vi.fn()}
        onDelete={onDelete}
        onSubmitProposal={onSubmitProposal}
        onRequireAuth={onRequireAuth}
      />
    );

    fireEvent.click(screen.getByText(/Sign In to Make an Offer/i));
    expect(onRequireAuth).toHaveBeenCalled();

    rerender(
      <LandDetailsPopup
        land={sampleLot}
        currentUser={{ token: 't', userId: 'buyer-2', name: 'Buyer', email: 'b@terrix.io' }}
        onClose={vi.fn()}
        onDelete={onDelete}
        onSubmitProposal={onSubmitProposal}
        onRequireAuth={onRequireAuth}
      />
    );

    fireEvent.click(screen.getByText(/Make Purchase Offer/i));
    fireEvent.change(screen.getByLabelText(/Message \/ Payment Terms/i), {
      target: { value: 'Immediate wire transfer' },
    });
    fireEvent.click(screen.getByText(/Submit Formal Proposal/i));
    expect(await screen.findByText(/Proposal error/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Submit Formal Proposal/i));
    expect(await screen.findByText(/Purchase proposal sent successfully/i)).toBeInTheDocument();

    rerender(
      <LandDetailsPopup
        land={{ ...sampleLot, status: 'AVAILABLE' }}
        currentUser={{ token: 't', userId: 'owner-1', name: 'Alice', email: 'a@terrix.io' }}
        onClose={vi.fn()}
        onDelete={onDelete}
        onSubmitProposal={onSubmitProposal}
        onRequireAuth={onRequireAuth}
      />
    );

    fireEvent.click(screen.getByText(/Remove My Listing/i));
    expect(onDelete).toHaveBeenCalledWith('lot-123');

    rerender(
      <LandDetailsPopup
        land={{ ...sampleLot, status: 'RESERVED' }}
        currentUser={{ token: 't', userId: 'owner-1', name: 'Alice', email: 'a@terrix.io' }}
        onClose={vi.fn()}
        onDelete={onDelete}
        onSubmitProposal={onSubmitProposal}
        onRequireAuth={onRequireAuth}
      />
    );

    expect(screen.queryByText(/Remove My Listing/i)).not.toBeInTheDocument();
  });

  it('renders AuthModal and tests both Register and Login with error handling', async () => {
    vi.spyOn(apiService, 'register').mockRejectedValueOnce(new Error('Email already exists'));
    vi.spyOn(apiService, 'login').mockResolvedValue({
      token: 'jwt',
      userId: 'u1',
      name: 'Alice',
      email: 'alice@terrix.io',
    });

    const onSuccess = vi.fn();
    render(<AuthModal onClose={vi.fn()} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByText(/Need an account\? Register now/i));
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'alice@terrix.io' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Email already exists/i);

    fireEvent.click(screen.getByText(/Already have an account\? Sign in/i));
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('renders main App, filters lands, opens proposals inbox and evaluates proposals', async () => {
    setStoredUser({ token: 'jwt', userId: 'owner-1', name: 'Alice Farmer', email: 'alice@terrix.io' });
    vi.spyOn(apiService, 'fetchAllLands').mockResolvedValue([
      sampleLot,
      { ...sampleLot, id: 'lot-2', status: 'RESERVED', price: 500000 },
    ]);
    vi.spyOn(apiService, 'fetchReceivedProposals').mockResolvedValue([sampleProposal]);
    vi.spyOn(apiService, 'evaluateProposal').mockResolvedValue({
      ...sampleProposal,
      status: 'ACCEPTED',
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/2 lots visible/i)).toBeInTheDocument();
    });

    // Filter by status and max price
    fireEvent.change(screen.getByLabelText(/Filter by status/i), { target: { value: 'AVAILABLE' } });
    expect(screen.getByText(/1 lots visible/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Maximum price filter/i), { target: { value: '100000' } });
    expect(screen.getByText(/0 lots visible/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Reset Map/i));
    await waitFor(() => {
      expect(screen.getByText(/2 lots visible/i)).toBeInTheDocument();
    });

    // Open Proposals Inbox and accept proposal
    fireEvent.click(screen.getByText(/Proposals Inbox/i));
    expect(await screen.findByText(/Received Purchase Proposals/i)).toBeInTheDocument();
    expect(screen.getByText(/Bob Buyer/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Accept proposal/i));
    await waitFor(() => {
      expect(apiService.evaluateProposal).toHaveBeenCalledWith('prop-1', true);
    });

    fireEvent.click(screen.getByText('Close'));

    // Sign out and open Auth Modal
    fireEvent.click(screen.getByLabelText(/Sign out/i));
    fireEvent.click(screen.getByText(/Sign In \/ Register/i));
    expect(screen.getByText(/Sign In to Terrix/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Close auth modal/i));
  });
});

describe('Additional App Callbacks Coverage', () => {
  it('covers remaining App toolbar, auth success, and reject proposal callbacks', async () => {
    sessionStorage.clear();
    vi.spyOn(apiService, 'fetchAllLands').mockRejectedValueOnce(new Error('Load error'));
    setStoredUser({ token: 'jwt', userId: 'u1', name: 'Alice', email: 'a@terrix.io' });

    render(<App />);
    expect(await screen.findByText(/Load error/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Dismiss'));

    // Toggle Draw & Circle modes and Satellite view
    fireEvent.click(screen.getByText(/Draw & List Land/i));
    fireEvent.click(screen.getByText(/Drawing Polygon/i));
    fireEvent.click(screen.getByText(/Circle Radius Search/i));
    fireEvent.click(screen.getByText(/Drag Mouse/i));
    fireEvent.click(screen.getByText(/Satellite View/i));

    // Clicking Proposals Inbox while logged out opens AuthModal
    fireEvent.click(screen.getByLabelText(/Sign out/i));
    vi.spyOn(apiService, 'login').mockResolvedValue({
      token: 'jwt',
      userId: 'owner-1',
      name: 'Alice',
      email: 'alice@terrix.io',
    });
    fireEvent.click(screen.getByText(/Sign In \/ Register/i));
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'alice@terrix.io' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }));

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Open inbox and reject proposal
    vi.spyOn(apiService, 'fetchReceivedProposals').mockResolvedValue([
      {
        id: 'prop-2',
        landLotId: 'lot-123',
        landLotTitle: 'Plot 2',
        buyerId: 'b2',
        buyerName: 'Buyer 2',
        buyerEmail: 'b2@terrix.io',
        offeredPrice: 100000,
        message: 'Offer',
        status: 'PENDING',
        createdAt: '2026-10-19T13:00:00Z',
      },
    ]);
    vi.spyOn(apiService, 'evaluateProposal').mockResolvedValue({} as any);
    vi.spyOn(apiService, 'fetchAllLands').mockResolvedValue([]);

    fireEvent.click(screen.getByText(/Proposals Inbox/i));
    fireEvent.click(await screen.findByLabelText(/Reject proposal/i));
    await waitFor(() => {
      expect(apiService.evaluateProposal).toHaveBeenCalledWith('prop-2', false);
    });
  });
});

describe('Edit Listing & User Profile Features', () => {
  const owner = { token: 'jwt', userId: 'owner-1', name: 'Alice Farmer', email: 'alice@terrix.io' };

  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('calls the new update/profile API endpoints', async () => {
    setStoredUser(owner);
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(
      async () => new Response(JSON.stringify([]), { status: 200 })
    );

    await apiService.updateLandLot('lot-123', { title: 'T', description: 'D', price: 1, contactInfo: 'C' });
    await apiService.fetchMyLands();
    await apiService.fetchMyProposals();
    await apiService.fetchLandById('lot-123');

    const calls = fetchMock.mock.calls.map(([url, init]) => [String(url), (init as RequestInit)?.method ?? 'GET']);
    expect(calls[0]).toEqual([expect.stringMatching(/\/lands\/lot-123$/), 'PUT']);
    expect(calls[1][0]).toMatch(/\/me\/lands$/);
    expect(calls[2][0]).toMatch(/\/me\/proposals$/);
    expect(calls[3][0]).toMatch(/\/lands\/lot-123$/);
    expect((fetchMock.mock.calls[1][1] as any).headers.Authorization).toBe('Bearer jwt');
  });

  it('renders EditLandModal pre-filled, validates and submits changes', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error('Only the owner can edit'))
      .mockResolvedValueOnce(undefined);

    render(<EditLandModal land={sampleLot} onClose={vi.fn()} onSubmit={onSubmit} />);

    expect(screen.getByLabelText(/Listing Title/i)).toHaveValue('Golden Valley Plot');
    expect(screen.getByLabelText(/Total Price/i)).toHaveValue(250000);

    fireEvent.change(screen.getByLabelText(/Total Price/i), { target: { value: '0' } });
    fireEvent.click(screen.getByText(/Save Changes/i));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid positive total price/i);

    fireEvent.change(screen.getByLabelText(/Total Price/i), { target: { value: '300000' } });
    fireEvent.change(screen.getByLabelText(/Listing Title/i), { target: { value: '   ' } });
    fireEvent.click(screen.getByText(/Save Changes/i));
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot be empty/i);

    fireEvent.change(screen.getByLabelText(/Listing Title/i), { target: { value: ' Renamed Plot ' } });
    fireEvent.click(screen.getByText(/Save Changes/i));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Only the owner can edit/i);

    fireEvent.click(screen.getByText(/Save Changes/i));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenLastCalledWith('lot-123', {
        title: 'Renamed Plot',
        description: sampleLot.description,
        price: 300000,
        contactInfo: sampleLot.contactInfo,
      });
    });
  });

  it('shows Edit Listing and Remove My Listing only for the owner of an AVAILABLE lot (not RESERVED or SOLD)', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const { rerender } = render(
      <LandDetailsPopup
        land={sampleLot}
        currentUser={owner}
        onClose={vi.fn()}
        onDelete={onDelete}
        onEdit={onEdit}
        onSubmitProposal={vi.fn()}
        onRequireAuth={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText(/Edit Listing/i));
    expect(onEdit).toHaveBeenCalledWith(sampleLot);
    fireEvent.click(screen.getByText(/Remove My Listing/i));
    expect(onDelete).toHaveBeenCalledWith(sampleLot.id);

    rerender(
      <LandDetailsPopup
        land={{ ...sampleLot, status: 'RESERVED' }}
        currentUser={owner}
        onClose={vi.fn()}
        onDelete={onDelete}
        onEdit={onEdit}
        onSubmitProposal={vi.fn()}
        onRequireAuth={vi.fn()}
      />
    );
    expect(screen.queryByText(/Edit Listing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Remove My Listing/i)).not.toBeInTheDocument();

    rerender(
      <LandDetailsPopup
        land={{ ...sampleLot, status: 'SOLD' }}
        currentUser={owner}
        onClose={vi.fn()}
        onDelete={onDelete}
        onEdit={onEdit}
        onSubmitProposal={vi.fn()}
        onRequireAuth={vi.fn()}
      />
    );
    expect(screen.queryByText(/Edit Listing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Remove My Listing/i)).not.toBeInTheDocument();

    rerender(
      <LandDetailsPopup
        land={sampleLot}
        currentUser={{ ...owner, userId: 'someone-else' }}
        onClose={vi.fn()}
        onDelete={onDelete}
        onEdit={onEdit}
        onSubmitProposal={vi.fn()}
        onRequireAuth={vi.fn()}
      />
    );
    expect(screen.queryByText(/Edit Listing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Remove My Listing/i)).not.toBeInTheDocument();
  });

  it('renders UserProfileModal with reservations and listings tabs', async () => {
    vi.spyOn(apiService, 'fetchMyProposals').mockResolvedValue([
      { ...sampleProposal, id: 'p-acc', status: 'ACCEPTED', landLotTitle: 'Reserved Farm', landLotPrice: 260000 },
      { ...sampleProposal, id: 'p-pen', landLotId: 'lot-9', landLotTitle: 'Pending Farm' },
    ]);
    vi.spyOn(apiService, 'fetchMyLands').mockResolvedValue([
      sampleLot,
      { ...sampleLot, id: 'lot-reserved', title: 'Reserved Plot', status: 'RESERVED' },
      { ...sampleLot, id: 'lot-sold', title: 'Sold Plot', status: 'SOLD' },
    ]);
    const onViewLand = vi.fn();
    const onEditLand = vi.fn();

    render(
      <UserProfileModal currentUser={owner} onClose={vi.fn()} onViewLand={onViewLand} onEditLand={onEditLand} />
    );

    expect(await screen.findByText('Reserved Farm')).toBeInTheDocument();
    expect(screen.getByText('Reserved for you')).toBeInTheDocument();
    expect(screen.getByText(/Awaiting owner/i)).toBeInTheDocument();
    expect(screen.getByText(/1 lot\(s\) reserved for you/i)).toBeInTheDocument();
    expect(screen.getByText(/Asking price: \$260,000/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/View Pending Farm on map/i));
    expect(onViewLand).toHaveBeenCalledWith('lot-9');

    fireEvent.click(screen.getByRole('tab', { name: /My Listings \(3\)/i }));
    expect(screen.getByText('Golden Valley Plot')).toBeInTheDocument();
    expect(screen.getByText('Reserved Plot')).toBeInTheDocument();
    expect(screen.getByText('Sold Plot')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Edit Reserved Plot/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Edit Sold Plot/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Edit Golden Valley Plot/i));
    expect(onEditLand).toHaveBeenCalledWith(sampleLot);
  });

  it('shows empty states and errors in UserProfileModal', async () => {
    vi.spyOn(apiService, 'fetchMyProposals').mockResolvedValue([]);
    vi.spyOn(apiService, 'fetchMyLands').mockResolvedValue([]);
    const { unmount } = render(
      <UserProfileModal currentUser={owner} onClose={vi.fn()} onViewLand={vi.fn()} onEditLand={vi.fn()} />
    );
    expect(await screen.findByText(/not requested any land lot reservation/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /My Listings/i }));
    expect(screen.getByText(/not listed any land lot yet/i)).toBeInTheDocument();
    unmount();

    vi.spyOn(apiService, 'fetchMyProposals').mockRejectedValue(new Error('Session expired'));
    render(<UserProfileModal currentUser={owner} onClose={vi.fn()} onViewLand={vi.fn()} onEditLand={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Session expired/i);
  });

  it('opens the profile from the header, edits a listing and focuses a lot on the map', async () => {
    setStoredUser(owner);
    vi.spyOn(apiService, 'fetchAllLands').mockResolvedValue([sampleLot]);
    vi.spyOn(apiService, 'fetchMyProposals').mockResolvedValue([
      { ...sampleProposal, landLotId: 'remote-lot', landLotTitle: 'Remote Farm' },
    ]);
    vi.spyOn(apiService, 'fetchMyLands').mockResolvedValue([sampleLot]);
    vi.spyOn(apiService, 'fetchLandById').mockResolvedValue({
      ...sampleLot,
      id: 'remote-lot',
      title: 'Remote Farm',
      ownerId: 'other',
    });
    const updateSpy = vi
      .spyOn(apiService, 'updateLandLot')
      .mockResolvedValue({ ...sampleLot, title: 'Golden Valley Plot v2' });

    render(<App />);
    await waitFor(() => expect(screen.getByText(/1 lots visible/i)).toBeInTheDocument());

    // Open profile pop-up → listings tab → edit
    fireEvent.click(screen.getByLabelText(/Open my profile/i));
    expect(await screen.findByTestId('user-profile-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /My Listings/i }));
    fireEvent.click(await screen.findByLabelText(/Edit Golden Valley Plot/i));

    expect(screen.getByTestId('edit-land-modal')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Listing Title/i), { target: { value: 'Golden Valley Plot v2' } });
    fireEvent.click(screen.getByText(/Save Changes/i));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith('lot-123', expect.objectContaining({ title: 'Golden Valley Plot v2' })));
    expect(await screen.findByText(/updated successfully/i)).toBeInTheDocument();
    expect(screen.queryByTestId('edit-land-modal')).not.toBeInTheDocument();

    // Openprofile / View a reservation whose lot is not loaded locally → fetched by id
    fireEvent.click(screen.getByRole('tab', { name: /My Reservations/i }));
    fireEvent.click(await screen.findByLabelText(/View Remote Farm on map/i));
    expect(await screen.findByTestId('land-details-popup')).toHaveTextContent('Remote Farm');
    expect(screen.queryByTestId('user-profile-modal')).not.toBeInTheDocument();
    expect(apiService.fetchLandById).toHaveBeenCalledWith('remote-lot');
  });

  it('enforces all land status rules (AVAILABLE, RESERVED, SOLD) and shows offer count only to owner', async () => {
    const onUpdateStatus = vi.fn().mockResolvedValue(undefined);
    const onEdit = vi.fn();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onSubmitProposal = vi.fn().mockResolvedValue(undefined);
    const buyer = { token: 'jwt-b', userId: 'buyer-2', name: 'Bob Buyer', email: 'bob@terrix.io' };

    // 1. AVAILABLE lot viewed by Owner (with 1 pending offer, not yet accepted) -> CANNOT mark as Sold yet!
    const { rerender } = render(
      <LandDetailsPopup
        land={{ ...sampleLot, status: 'AVAILABLE', proposalCount: 1 }}
        currentUser={owner}
        onClose={vi.fn()}
        onDelete={onDelete}
        onUpdateStatus={onUpdateStatus}
        onEdit={onEdit}
        onSubmitProposal={onSubmitProposal}
        onRequireAuth={vi.fn()}
      />
    );

    expect(screen.getByTestId('land-offers-count')).toHaveTextContent('Offers received: 1 offer');
    expect(screen.queryByText(/Mark as Sold \(Close Deal\)/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Edit Listing/i)).toBeInTheDocument();
    expect(screen.getByText(/Remove My Listing/i)).toBeInTheDocument();
    expect(screen.queryByText(/Reopen as Available/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Make Purchase Offer/i)).not.toBeInTheDocument();

    // 2. AVAILABLE lot viewed by Buyer -> cannot see owner's offer count or owner actions, can make offer
    rerender(
      <LandDetailsPopup
        land={{ ...sampleLot, status: 'AVAILABLE', proposalCount: 3 }}
        currentUser={buyer}
        onClose={vi.fn()}
        onDelete={onDelete}
        onUpdateStatus={onUpdateStatus}
        onEdit={onEdit}
        onSubmitProposal={onSubmitProposal}
        onRequireAuth={vi.fn()}
      />
    );
    expect(screen.queryByTestId('land-offers-count')).not.toBeInTheDocument();
    expect(screen.getByText(/Make Purchase Offer/i)).toBeInTheDocument();
    expect(screen.queryByText(/Edit Listing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Remove My Listing/i)).not.toBeInTheDocument();

    // 3. RESERVED lot viewed by Owner (with 3 offers) -> CANNOT Edit or Remove, can Mark as Sold or Reopen as Available
    rerender(
      <LandDetailsPopup
        land={{ ...sampleLot, status: 'RESERVED', proposalCount: 3 }}
        currentUser={owner}
        onClose={vi.fn()}
        onDelete={onDelete}
        onUpdateStatus={onUpdateStatus}
        onEdit={onEdit}
        onSubmitProposal={onSubmitProposal}
        onRequireAuth={vi.fn()}
      />
    );
    expect(screen.getByTestId('land-offers-count')).toHaveTextContent('Offers received: 3 offers');
    expect(screen.queryByText(/Edit Listing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Remove My Listing/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Reopen as Available/i)).toBeInTheDocument();
    expect(screen.getByText(/Mark as Sold \(Close Deal\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Reopen as Available/i));
    expect(onUpdateStatus).toHaveBeenCalledWith('lot-123', 'AVAILABLE');

    fireEvent.click(screen.getByText(/Mark as Sold \(Close Deal\)/i));
    expect(onUpdateStatus).toHaveBeenCalledWith('lot-123', 'SOLD');

    // 4. RESERVED lot viewed by Buyer -> cannot make purchase offer or edit
    rerender(
      <LandDetailsPopup
        land={{ ...sampleLot, status: 'RESERVED', proposalCount: 3 }}
        currentUser={buyer}
        onClose={vi.fn()}
        onDelete={onDelete}
        onUpdateStatus={onUpdateStatus}
        onEdit={onEdit}
        onSubmitProposal={onSubmitProposal}
        onRequireAuth={vi.fn()}
      />
    );
    expect(screen.queryByText(/Make Purchase Offer/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('land-offers-count')).not.toBeInTheDocument();

    // 5. SOLD lot viewed by Owner -> CANNOT Reopen as Available, CANNOT Edit, CANNOT Mark as Sold, CANNOT Remove
    rerender(
      <LandDetailsPopup
        land={{ ...sampleLot, status: 'SOLD', proposalCount: 2 }}
        currentUser={owner}
        onClose={vi.fn()}
        onDelete={onDelete}
        onUpdateStatus={onUpdateStatus}
        onEdit={onEdit}
        onSubmitProposal={onSubmitProposal}
        onRequireAuth={vi.fn()}
      />
    );
    expect(screen.getByTestId('land-offers-count')).toHaveTextContent('Offers received: 2 offers');
    expect(screen.queryByText(/Reopen as Available/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Edit Listing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mark as Sold/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Remove My Listing/i)).not.toBeInTheDocument();
  });

  it('displays red notification dot on Proposals Inbox when pending proposals exist and clears it once evaluated', async () => {
    setStoredUser(owner);
    vi.spyOn(apiService, 'fetchAllLands').mockResolvedValue([
      { ...sampleLot, proposalCount: 1 },
    ]);
    const fetchProposalsSpy = vi
      .spyOn(apiService, 'fetchReceivedProposals')
      .mockResolvedValue([sampleProposal]);
    vi.spyOn(apiService, 'evaluateProposal').mockResolvedValue({
      ...sampleProposal,
      status: 'ACCEPTED',
    });

    render(<App />);

    // Notification red dot should appear automatically because sampleProposal is PENDING
    expect(await screen.findByTestId('proposals-inbox-notification-dot')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Proposals Inbox/i));
    expect(await screen.findByText(/Received Purchase Proposals/i)).toBeInTheDocument();

    // When owner accepts the pending proposal, fetchReceivedProposals returns ACCEPTED -> red dot disappears
    fetchProposalsSpy.mockResolvedValue([
      { ...sampleProposal, status: 'ACCEPTED' },
    ]);
    fireEvent.click(screen.getByLabelText(/Accept proposal/i));

    await waitFor(() => {
      expect(screen.queryByTestId('proposals-inbox-notification-dot')).not.toBeInTheDocument();
    });
  });

  it('only shows Mark as Sold after accepting an offer (AVAILABLE -> RESERVED -> SOLD) and prevents reopening once SOLD', async () => {
    setStoredUser(owner);
    const availableLot: LandLot = { ...sampleLot, status: 'AVAILABLE', proposalCount: 1 };
    const reservedLot: LandLot = { ...sampleLot, status: 'RESERVED', proposalCount: 1 };
    const soldLot: LandLot = { ...sampleLot, status: 'SOLD', proposalCount: 1 };

    const fetchLandsSpy = vi.spyOn(apiService, 'fetchAllLands').mockResolvedValue([availableLot]);
    const fetchProposalsSpy = vi
      .spyOn(apiService, 'fetchReceivedProposals')
      .mockResolvedValue([sampleProposal]);
    vi.spyOn(apiService, 'fetchMyProposals').mockResolvedValue([]);
    vi.spyOn(apiService, 'fetchMyLands').mockResolvedValue([availableLot]);
    vi.spyOn(apiService, 'evaluateProposal').mockResolvedValue({
      ...sampleProposal,
      status: 'ACCEPTED',
    });
    const updateStatusSpy = vi.spyOn(apiService, 'updateLandStatus').mockResolvedValue(soldLot);

    render(<App />);
    await waitFor(() => expect(screen.getByText(/1 lots visible/i)).toBeInTheDocument());

    // 1. Open profile -> My Listings -> View AVAILABLE lot on map
    fireEvent.click(screen.getByLabelText(/Open my profile/i));
    fireEvent.click(screen.getByRole('tab', { name: /My Listings/i }));
    fireEvent.click(await screen.findByLabelText(/View Golden Valley Plot on map/i));

    const popup = await screen.findByTestId('land-details-popup');
    expect(popup).toHaveTextContent('AVAILABLE');
    expect(screen.getByTestId('land-offers-count')).toHaveTextContent('Offers received: 1 offer');
    // While AVAILABLE (no accepted offer), Edit Listing and Remove My Listing are visible, while Mark as Sold and Reopen as Available MUST NOT be visible!
    expect(screen.getByText(/Edit Listing/i)).toBeInTheDocument();
    expect(screen.getByText(/Remove My Listing/i)).toBeInTheDocument();
    expect(screen.queryByText(/Mark as Sold \(Close Deal\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reopen as Available/i)).not.toBeInTheDocument();

    // 2. Owner opens Proposals Inbox and accepts the buyer's proposal -> lot transitions to RESERVED
    fireEvent.click(screen.getByText(/Proposals Inbox/i));
    expect(await screen.findByText(/Received Purchase Proposals/i)).toBeInTheDocument();

    fetchLandsSpy.mockResolvedValue([reservedLot]);
    fetchProposalsSpy.mockResolvedValue([{ ...sampleProposal, status: 'ACCEPTED' }]);
    fireEvent.click(screen.getByLabelText(/Accept proposal/i));

    await waitFor(() => {
      expect(apiService.evaluateProposal).toHaveBeenCalledWith('prop-1', true);
    });
    fireEvent.click(screen.getByText('Close'));

    // Now that the offer was accepted, the popup reflects RESERVED, hides "Edit Listing" & "Remove My Listing", and shows "Mark as Sold (Close Deal)" & "Reopen as Available"
    expect(await screen.findByTestId('land-details-popup')).toHaveTextContent('RESERVED');
    expect(screen.queryByText(/Edit Listing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Remove My Listing/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Mark as Sold \(Close Deal\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Reopen as Available/i)).toBeInTheDocument();

    // 3. Owner clicks "Mark as Sold (Close Deal)" -> lot transitions to SOLD
    fetchLandsSpy.mockResolvedValue([soldLot]);
    fireEvent.click(screen.getByText(/Mark as Sold \(Close Deal\)/i));

    await waitFor(() => {
      expect(updateStatusSpy).toHaveBeenCalledWith('lot-123', 'SOLD');
    });

    expect(await screen.findByText(/marked as SOLD/i)).toBeInTheDocument();
    expect(screen.getByTestId('land-details-popup')).toHaveTextContent('SOLD');
    // Once SOLD, Mark as Sold, Reopen as Available, Edit Listing, and Remove My Listing buttons must no longer exist
    expect(screen.queryByText(/Mark as Sold \(Close Deal\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reopen as Available/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Edit Listing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Remove My Listing/i)).not.toBeInTheDocument();
  });
});
