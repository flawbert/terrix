CREATE INDEX IF NOT EXISTS idx_land_lots_geography ON land_lots USING GIST (CAST(geometry AS geography));

INSERT INTO users (id, name, email, password_hash)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Helena Vance', 'helena@terrix.io', '$2a$10$7EqJtq98hPqEX7fNZaFWoOHi6M2.j5N3p2S5kG5W1x0H5K5W1x0H5'),
  ('22222222-2222-2222-2222-222222222222', 'Marcus Silva', 'marcus@terrix.io', '$2a$10$7EqJtq98hPqEX7fNZaFWoOHi6M2.j5N3p2S5kG5W1x0H5K5W1x0H5')
ON CONFLICT (email) DO NOTHING;

INSERT INTO land_lots (id, title, description, price, area_sq_meters, contact_info, status, geometry, owner_id)
VALUES
  (
    'aaaa1111-1111-1111-1111-111111111111',
    'Santa Genebra Agro-Tech Lot #01',
    'Flat corner plot with direct highway access, ideal for logistics or agricultural research center.',
    420000.00,
    18450.00,
    'helena@terrix.io | +55 (19) 99811-2233',
    'AVAILABLE',
    ST_GeomFromText('POLYGON((-47.0650 -22.9060, -47.0635 -22.9060, -47.0635 -22.9048, -47.0650 -22.9048, -47.0650 -22.9060))', 4326),
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'bbbb2222-2222-2222-2222-222222222222',
    'Vale Verde Irrigated Plot #02',
    'High-fertility soil with natural water stream and three-phase rural power grid installed.',
    680000.00,
    31200.00,
    'helena@terrix.io | +55 (19) 99811-2233',
    'AVAILABLE',
    ST_GeomFromText('POLYGON((-47.0605 -22.9065, -47.0585 -22.9065, -47.0585 -22.9048, -47.0605 -22.9048, -47.0605 -22.9065))', 4326),
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'cccc3333-3333-3333-3333-333333333333',
    'Golden Horizon Reserve #03',
    'Reserved commercial plot near technology park.',
    310000.00,
    12500.00,
    'marcus@terrix.io | +55 (19) 99122-4455',
    'RESERVED',
    ST_GeomFromText('POLYGON((-47.0645 -22.9035, -47.0628 -22.9035, -47.0628 -22.9022, -47.0645 -22.9022, -47.0645 -22.9035))', 4326),
    '22222222-2222-2222-2222-222222222222'
  )
ON CONFLICT (id) DO NOTHING;
