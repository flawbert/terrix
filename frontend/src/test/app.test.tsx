import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { formatArea, formatCurrency, formatDistance } from '../utils/formatters';
import { apiService, getStoredUser, setStoredUser } from '../services/api';
import { CreateLandModal } from '../components/CreateLandModal';
import { AuthModal } from '../components/AuthModal';
import { LandDetailsPopup } from '../components/LandDetailsPopup';
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
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('stores, retrieves and handles malformed localStorage user data', () => {
    expect(getStoredUser()).toBeNull();
    const user = { token: 'jwt-1', userId: 'u-1', name: 'Bob', email: 'bob@terrix.io' };
    setStoredUser(user);
    expect(getStoredUser()?.email).toBe('bob@terrix.io');
    setStoredUser(null);
    expect(getStoredUser()).toBeNull();

    localStorage.setItem('terrix_auth_user', '{invalid-json');
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
    localStorage.clear();
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
        land={{ ...sampleLot, status: 'RESERVED' }}
        currentUser={{ token: 't', userId: 'owner-1', name: 'Alice', email: 'a@terrix.io' }}
        onClose={vi.fn()}
        onDelete={onDelete}
        onSubmitProposal={onSubmitProposal}
        onRequireAuth={onRequireAuth}
      />
    );

    fireEvent.click(screen.getByText(/Remove My Listing/i));
    expect(onDelete).toHaveBeenCalledWith('lot-123');
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
    localStorage.clear();
    vi.spyOn(apiService, 'fetchAllLands').mockRejectedValueOnce(new Error('Load error'));

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
