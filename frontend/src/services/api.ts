import {
  AuthUser,
  CircleSearchParams,
  CreateLandLotPayload,
  LandLot,
  LandStatus,
  Proposal,
} from '../types/land';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
const STORAGE_KEY = 'terrix_auth_user';

export function getStoredUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser | null): void {
  if (!user) {
    sessionStorage.removeItem(STORAGE_KEY);
  } else {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }
}

function getAuthHeaders(): HeadersInit {
  const user = getStoredUser();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (user?.token) {
    headers['Authorization'] = `Bearer ${user.token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMessage = `Request failed with status ${res.status}`;
    try {
      const errData = await res.json();
      errorMessage = errData.detail || errData.title || errData.message || errorMessage;
    } catch {
      // fallback to status message
    }
    throw new Error(errorMessage);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const apiService = {
  async fetchAllLands(): Promise<LandLot[]> {
    const res = await fetch(`${API_BASE_URL}/lands`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<LandLot[]>(res);
  },

  async searchLandsByCircle(params: CircleSearchParams): Promise<LandLot[]> {
    const query = new URLSearchParams({
      centerLon: String(params.centerLon),
      centerLat: String(params.centerLat),
      radiusMeters: String(params.radiusMeters),
    });
    if (params.maxPrice !== undefined && params.maxPrice > 0) {
      query.append('maxPrice', String(params.maxPrice));
    }
    if (params.status) {
      query.append('status', params.status);
    }

    const res = await fetch(`${API_BASE_URL}/lands/search/circle?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<LandLot[]>(res);
  },

  async createLandLot(payload: CreateLandLotPayload): Promise<LandLot> {
    const res = await fetch(`${API_BASE_URL}/lands`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<LandLot>(res);
  },

  async updateLandStatus(id: string, status: LandStatus): Promise<LandLot> {
    const res = await fetch(`${API_BASE_URL}/lands/${id}/status?status=${status}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    return handleResponse<LandLot>(res);
  },

  async deleteLandLot(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/lands/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<void>(res);
  },

  async login(email: string, password: string): Promise<AuthUser> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse<AuthUser>(res);
  },

  async register(name: string, email: string, password: string): Promise<AuthUser> {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    return handleResponse<AuthUser>(res);
  },

  async submitProposal(landLotId: string, offeredPrice: number, message: string): Promise<Proposal> {
    const res = await fetch(`${API_BASE_URL}/lands/${landLotId}/proposals`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ offeredPrice, message }),
    });
    return handleResponse<Proposal>(res);
  },

  async fetchReceivedProposals(): Promise<Proposal[]> {
    const res = await fetch(`${API_BASE_URL}/proposals/received`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Proposal[]>(res);
  },

  async evaluateProposal(proposalId: string, accept: boolean): Promise<Proposal> {
    const res = await fetch(`${API_BASE_URL}/proposals/${proposalId}/evaluate?accept=${accept}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    return handleResponse<Proposal>(res);
  },
};
