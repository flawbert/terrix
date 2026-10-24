# Terrix — Architecture & Technical Decision Records (ADRs)

## 1. Container & Network Topology (docker-compose.yml)

    Browser (http://localhost:3000)
       │  Port Mapping 3000:80 (External:Internal)
       ▼
    [terrix-web] (Nginx Alpine)
       │  Serves React 18 + OpenLayers SPA static bundle
       │  Reverse proxies /api/* to http://terrix-api:8080
       ▼
    [terrix-api] (Java 21 / Spring Boot 3.4 — Port 8080:8080)
       │  Stateless JWT Filter + Strategy Pattern Spatial Validators
       ▼
    [terrix-db] (PostgreSQL 16 + PostGIS 3.4 — Port 5432:5432)
          GIST Index on geometry(Polygon, 4326) & CAST(geometry AS geography)

## 2. Key Architecture Decision Records (ADRs)

### ADR-001: Hybrid PostGIS Storage (geometry SRID 4326 with geography Casts)
- **Decision:** Store polygons as `geometry(Polygon, 4326)` for fast topological predicates (`ST_Intersects`, `ST_Touches`) backed by a standard `GIST` index, and cast to `geography` (`CAST(geometry AS geography)`) with a functional `GIST` index for metric operations (`ST_DWithin` radius search and `ST_Area` square meter calculation).

### ADR-002: Geodesic Intersection Tolerance (> 0.5 m²) for OpenLayers Edge Snapping
- **Decision:** Combine `ST_Intersects(a, b) AND NOT ST_Touches(a, b)` with `ST_Area(CAST(ST_Intersection(a, b) AS geography)) > 0.5` so adjacent lots can snap cleanly to shared borders without floating-point false positives.

### ADR-003: Strategy Pattern for Spatial & Domain Validations
- **Decision:** Define the `LandValidationStrategy` interface and inject all implementations (`PolygonOverlapValidationStrategy`, `MinimumAreaValidationStrategy`) into `LandLotService`, adhering to the Open/Closed Principle (SOLID).

### ADR-004: Stateless JWT + sessionStorage + BroadcastChannel for Multi-User Concurrency
- **Decision:** Use stateless JWT tokens stored in `sessionStorage` (per-tab isolation) paired with a `BroadcastChannel` synchronization utility (`liveSync.ts`) so two users can operate simultaneously in separate tabs with real-time map updates.

### ADR-005: Land Lot Lifecycle State Machine & Mutation Guards (`AVAILABLE` -> `RESERVED` -> `SOLD`)
- **Decision:** Enforce strict state-machine transitions and ownership/status guards in `LandLotService` and `ProposalService`:
  - **Editing & Deletion (`PUT /api/v1/lands/{id}`, `DELETE /api/v1/lands/{id}`):** Allowed exclusively for the lot owner while the status is `AVAILABLE`. Once a lot is `RESERVED` or `SOLD`, editing and deletion are blocked (`422 Unprocessable Entity`) and hidden in the UI.
  - **Proposals (`POST /api/v1/lands/{id}/proposals`, `PATCH /api/v1/proposals/{id}/evaluate`):** New offers can only be submitted on `AVAILABLE` lots by non-owners. Accepting an offer transitions the lot from `AVAILABLE` to `RESERVED`.
  - **Closing or Reopening (`PATCH /api/v1/lands/{id}/status`):** A lot can only be marked as `SOLD` when it is currently `RESERVED` (after an accepted offer). Reopening a `RESERVED` lot (`RESERVED -> AVAILABLE`) rejects the accepted proposal. Once `SOLD`, the status is terminal and cannot be reopened or modified.
