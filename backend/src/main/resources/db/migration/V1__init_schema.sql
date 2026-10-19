-- Enable PostGIS extension for spatial types and functions
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table for authentication and ownership
CREATE TABLE users (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Land lots table with PostGIS Polygon geometry (SRID 4326 - WGS 84)
CREATE TABLE land_lots (
    id UUID PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(15, 2) NOT NULL CHECK (price > 0),
    area_sq_meters DOUBLE PRECISION NOT NULL CHECK (area_sq_meters > 0),
    contact_info VARCHAR(150) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    geometry GEOMETRY(Polygon, 4326) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Spatial GIST index for high-performance intersection and radius queries
CREATE INDEX idx_land_lots_geometry ON land_lots USING GIST (geometry);
CREATE INDEX idx_land_lots_status ON land_lots (status);
CREATE INDEX idx_land_lots_price ON land_lots (price);

-- Purchase proposals table to promote negotiations on the platform
CREATE TABLE proposals (
    id UUID PRIMARY KEY,
    land_lot_id UUID NOT NULL REFERENCES land_lots(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offered_price NUMERIC(15, 2) NOT NULL CHECK (offered_price > 0),
    message TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_proposals_land_lot ON proposals (land_lot_id);
CREATE INDEX idx_proposals_buyer ON proposals (buyer_id);