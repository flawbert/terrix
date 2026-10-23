import {
  AuthUser,
  CircleSearchFilter,
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

function getHeaders(includeAuth = true): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (includeAuth) {
    const user = getStoredUser();
    if (user?.token) {
      headers['Authorization'] = `Bearer ${user.token}`;
    }
  }
  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMessage = errorData.detail;
      } else if (errorData.title) {
        errorMessage = errorData.title;
      }
    } catch {
      // Fallback to default message
    }
    throw new Error(errorMessage);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export const apiService = {
  async fetchAllLands(): Promise<LandLot[]> {
    const res = await fetch(`${API_BASE_URL}/lands`, {
      headers: getHeaders(false),
    });
    return handleResponse<LandLot[]>(res);
  },

  async searchLandsByCircle(filter: CircleSearchFilter): Promise<LandLot[]> {
    const params = new URLSearchParams({
      centerLon: filter.centerLon.toString(),
      centerLat: filter.centerLat.toString(),
      radiusMeters: filter.radiusMeters.toString(),
    });
    if (filter.maxPrice && filter.maxPrice > 0) {
      params.append('maxPrice', filter.maxPrice.toString());
    }
    if (filter.status) {
      params.append('status', filter.status);
    }

    const res = await fetch(`${API_BASE_URL}/lands/search/circle?${params.toString()}`, {
      headers: getHeaders(false),
    });
    return handleResponse<LandLot[]>(res);
  },

  async createLandLot(payload: CreateLandLotPayload): Promise<LandLot> {
    const res = await fetch(`${API_BASE_URL}/lands`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify(payload),
    });
    return handleResponse<LandLot>(res);
  },

  async updateLandStatus(id: string, status: LandStatus): Promise<LandLot> {
    const response = await fetch(`${API_BASE_URL}/lands/${id}/status?status=${status}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    return handleResponse<LandLot>(response);
  },

  async deleteLandLot(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/lands/${id}`, {
      method: 'DELETE',
      headers: getHeaders(true),
    });
    return handleResponse<void>(res);
  },

  async register(name: string, email: string, password: string): Promise<AuthUser> {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: getHeaders(false),
      body: JSON.stringify({ name, email, password }),
    });
    const user = await handleResponse<AuthUser>(res);
    setStoredUser(user);
    return user;
  },

  async login(email: string, password: string): Promise<AuthUser> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: getHeaders(false),
      body: JSON.stringify({ email, password }),
    });
    const user = await handleResponse<AuthUser>(res);
    setStoredUser(user);
    return user;
  },

  async submitProposal(landLotId: string, offeredPrice: number, message: string): Promise<Proposal> {
    const res = await fetch(`${API_BASE_URL}/lands/${landLotId}/proposals`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({ offeredPrice, message }),
    });
    return handleResponse<Proposal>(res);
  },

  async fetchReceivedProposals(): Promise<Proposal[]> {
    const res = await fetch(`${API_BASE_URL}/proposals/received`, {
      headers: getHeaders(true),
    });
    return handleResponse<Proposal[]>(res);
  },

  async evaluateProposal(proposalId: string, accept: boolean): Promise<Proposal> {
    const res = await fetch(`${API_BASE_URL}/proposals/${proposalId}/evaluate?accept=${accept}`, {
      method: 'PATCH',
      headers: getHeaders(true),
    });
    return handleResponse<Proposal>(res);
  },
};
