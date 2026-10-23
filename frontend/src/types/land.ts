export type LandStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD';
export type ProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface LandLot {
  id: string;
  title: string;
  description: string;
  price: number;
  areaSqMeters: number;
  pricePerSqMeter: number;
  contactInfo: string;
  status: LandStatus;
  geometry: GeoJsonPolygon;
  ownerId: string;
  ownerName: string;
  createdAt: string;
}

export interface CreateLandLotPayload {
  title: string;
  description: string;
  price: number;
  contactInfo: string;
  geometry: GeoJsonPolygon;
}

export interface UpdateLandLotPayload {
  title: string;
  description: string;
  price: number;
  contactInfo: string;
}

export interface CircleSearchFilter {
  centerLon: number;
  centerLat: number;
  radiusMeters: number;
  maxPrice?: number;
  status?: LandStatus | '';
}

export interface AuthUser {
  token: string;
  userId: string;
  name: string;
  email: string;
}

export interface Proposal {
  id: string;
  landLotId: string;
  landLotTitle: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  offeredPrice: number;
  message: string;
  status: ProposalStatus;
  createdAt: string;
  landLotStatus?: LandStatus;
  landLotPrice?: number;
}
