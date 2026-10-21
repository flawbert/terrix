# Terrix — Interactive Geospatial Land Marketplace

![Java](https://img.shields.io/badge/Java-21-orange)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.4.3-brightgreen)
![PostGIS](https://img.shields.io/badge/PostgreSQL_16-PostGIS_3.4-blue)
![React](https://img.shields.io/badge/React_18-TypeScript-61DAFB)
![OpenLayers](https://img.shields.io/badge/OpenLayers-10.3-1F6B75)
![Coverage](https://img.shields.io/badge/Coverage-%3E90%25-success)

**Terrix** is a full-stack geospatial web platform for listing, discovering, and negotiating land lots directly on an interactive map. Built with **Java 21 (Spring Boot 3)**, **PostgreSQL + PostGIS**, and **React 18 (TypeScript + OpenLayers 10)**, it combines topological validation with real-time geodesic calculations.

---

## Table of Contents
1. [What is the System?](#1-what-is-the-system)
2. [How It Works (Architecture, Data Flow & Technical Solutions)](#2-how-it-works-architecture-data-flow--technical-solutions)
3. [How to Run with Docker (Recommended)](#3-how-to-run-with-docker-recommended)
4. [How to Run Locally (Without Docker)](#4-how-to-run-locally-without-docker)
5. [How to Run Tests & View Code Coverage (>80%)](#5-how-to-run-tests--view-code-coverage-80)
6. [API Endpoints Reference](#6-api-endpoints-reference)

---

## 1. What is the System?

Traditional real estate and agricultural land platforms rely on static text descriptions and approximate pins, making it difficult for buyers to understand exact plot boundaries, neighboring properties, and real surface areas.

**Terrix** solves this by placing an interactive **OpenLayers** map at the center of the user experience:

### Core Mandatory Workflows
- **Interactive Polygon Registration (`Draw & List Land`):** Authenticated users navigate freely on the map (switching between Street and Satellite Imagery views) and draw the exact polygon vertices of the land lot they want to announce. While drawing, a live tooltip displays the real-time geodesic area in square meters (m²) and hectares (ha). Upon finishing the polygon, the user fills out a listing form (title, total price, description, and seller contact).
- **PostGIS Spatial Overlap Prevention:** The system strictly blocks the registration of any land lot whose geometry overlaps an already registered plot (`HTTP 409 Conflict`), while allowing adjacent lots to share boundary fences/walls via edge snapping.
- **Dynamic Circle Radius Search (`geojson.io` style):** Any visitor can click **"Circle Radius Search"**, click a center point on the map, and drag the mouse cursor outward. While dragging, a floating tooltip displays the exact geodesic radius in meters/kilometers in real time. Releasing the mouse queries PostGIS to render only the land lots that intersect that circular area.
- **Interactive Lot Inspection Popup:** Clicking any land polygon on the map smoothly zooms into the plot and opens a detailed card displaying its status (`AVAILABLE`, `RESERVED`, `SOLD`), total price, calculated price per m², PostGIS-verified geodesic area (m² and ha), description, owner name, and contact details.

### Extra Features & Differentiators
- **Stateless JWT Authentication & Route Protection:** Users can register and sign in with email and password (`BCrypt` hashing + `HMAC-SHA256` JWT). Public visitors can explore the map and perform circle searches freely, while mutating operations (creating listings, submitting purchase offers, managing status, or deleting lots) require authentication and strict ownership verification.
- **Purchase Proposals & Lot Reservation Workflow:** Logged-in buyers can submit formal purchase offers (custom price + payment terms message) on available lots. Landowners have a **"Proposals Inbox"** modal where they can **Accept** (automatically transitioning the land lot status to `RESERVED` on the map and rejecting competing pending offers) or **Reject** proposals.
- **Multi-Tab Real-Time Synchronization:** Powered by `sessionStorage` JWT isolation and the browser `BroadcastChannel` API, two different users can interact with the application simultaneously in separate browser tabs—any land lot created, reserved, or removed in Tab A automatically updates on Tab B's map in real time.
- **Satellite & Street Map Hybrid Switcher + Combined Filters:** Users can toggle Esri World Imagery satellite layers, view a semantic color status legend, and combine spatial circle searches with status and maximum price filters.

---

## 2. How It Works (Architecture, Data Flow & Technical Solutions)

### High-Level Architecture
The project is structured as a clean monorepo containing three orchestrated services (`terrix-db`, `terrix-api`, and `terrix-web`):

    terrix/
    ├── backend/                  # Java 21 + Spring Boot 3.4 + Hibernate Spatial + Flyway + JaCoCo
    │   └── src/main/java/com/terrix/
    │       ├── config/           # Spring Security filter chain, CORS & BCrypt beans
    │       ├── controller/       # REST Controllers (LandLotController, AuthController, ProposalController)
    │       ├── domain/           # JPA Entities (JTS Polygon SRID 4326), Enums & PostGIS Repositories
    │       ├── dto/              # Immutable Java Records for request/response payloads & GeoJSON
    │       ├── exception/        # RFC 7807 ProblemDetail GlobalExceptionHandler
    │       ├── security/         # Stateless JwtService & JwtAuthenticationFilter
    │       ├── service/          # Transactional domain services & Strategy Pattern validators
    │       └── util/             # JTS Polygon <-> GeoJSON conversion & topological sanity checks
    ├── frontend/                 # React 18 + TypeScript + Vite + OpenLayers 10 + TailwindCSS + Vitest
    │   └── src/
    │       ├── components/       # LandMap (OpenLayers engine), LandDetailsPopup, CreateLandModal, AuthModal
    │       ├── services/         # Typed Fetch API client & sessionStorage JWT management
    │       ├── types/            # TypeScript interfaces for GeoJSON, LandLot, Proposal, and Auth
    │       └── utils/            # Geodesic formatters & BroadcastChannel cross-tab live sync
    ├── docs/                     # Detailed Architecture & Architecture Decision Records (ADRs)
    └── docker-compose.yml        # Full-stack container orchestration

### SOLID Principles & Design Patterns Applied
1. **Strategy Pattern (`LandValidationStrategy` — Open/Closed Principle):**
   - Spatial and domain validations executed during land lot creation are decoupled into independent strategy beans implementing `LandValidationStrategy`:
     - `PolygonOverlapValidationStrategy` (`@Order(1)`): Queries PostGIS to ensure the candidate polygon does not overlap existing lots.
     - `MinimumAreaValidationStrategy` (`@Order(2)`): Queries PostGIS geodesic area calculation to enforce a minimum plot size (>= 25 m²) and prevent degenerate slivers.
   - `LandLotService` receives `List<LandValidationStrategy>` via constructor dependency injection. New spatial rules (e.g., environmental reserve restriction) can be added as new `@Component` classes without modifying `LandLotService`.
2. **DTO Pattern with Immutable Java Records:**
   - Entities (`LandLot`, `User`, `Proposal`) are never exposed directly in controllers. Java `record` DTOs (`LandLotResponse`, `CreateLandLotRequest`, `GeoJsonPolygonDto`) ensure immutability and clean serialization.
3. **RFC 7807 Problem Details (`GlobalExceptionHandler`):**
   - Domain exceptions map to standardized HTTP status codes:
     - `LandOverlapException` -> **`409 Conflict`** (the request syntax and geometry are valid, but conflict with the current spatial state of the database).
     - `InvalidGeometryException` / `BusinessRuleException` -> **`400 Bad Request`**.
     - `ResourceNotFoundException` -> **`404 Not Found`**.

### Spatial Engine: `geometry` vs. `geography` & Boundary Snapping Tolerance
A core technical challenge in geospatial web applications is bridging **Web Mercator (`EPSG:3857`)** used by interactive map canvases with **WGS 84 (`EPSG:4326`)** used by PostGIS, while handling both topological relationships and metric measurements accurately:

| Aspect | PostGIS `geometry(Polygon, 4326)` | PostGIS `geography(Polygon, 4326)` |
| :--- | :--- | :--- |
| **Mathematical Model** | Planar / Cartesian 2D Euclidean space | Spheroidal / Geodesic model (Earth's curvature) |
| **Measurement Units** | Decimal degrees (`°`) | Real meters (`m`) and square meters (`m²`) |
| **Used in Terrix For** | Fast topological checks (`ST_Intersects`, `ST_Touches`) | Exact radius search (`ST_DWithin`) & area (`ST_Area`) |
| **Spatial Index** | `USING GIST (geometry)` | `USING GIST (CAST(geometry AS geography))` |

#### 1. Overlap Detection with Edge-Snapping Tolerance (`existsOverlappingLand`)
When a user draws a new plot adjacent to an existing lot using OpenLayers `Snap` interaction, floating-point coordinate transformations (`EPSG:3857` <-> `EPSG:4326`) can introduce microscopic sub-meter intersections along shared borders. Terrix solves this in `LandLotRepository`:

    SELECT EXISTS (
        SELECT 1 FROM land_lots l
        WHERE ST_Intersects(l.geometry, :candidateGeometry)
          AND NOT ST_Touches(l.geometry, :candidateGeometry)
          AND ST_Area(CAST(ST_Intersection(l.geometry, :candidateGeometry) AS geography)) > 0.5
    )

- `ST_Intersects` leverages the `GIST` index to find candidate intersections rapidly.
- `NOT ST_Touches` allows neighboring lots to share boundary vertices/edges.
- `ST_Area(CAST(ST_Intersection(...) AS geography)) > 0.5` ignores sub-0.5 m² floating-point noise from edge snapping while strictly blocking any actual plot overlap.

#### 2. Dynamic Circle Search (`searchWithinCircle`)

    SELECT l.* FROM land_lots l
    WHERE ST_DWithin(
        CAST(l.geometry AS geography),
        CAST(ST_SetSRID(ST_MakePoint(:centerLon, :centerLat), 4326) AS geography),
        :radiusInMeters
    )

- Casting both the stored polygon and the circle's center point to `geography` allows `ST_DWithin` to evaluate exact meter distances across the Earth's surface, returning any land lot that is inside or intersects the drawn circle boundary.

---

## 3. How to Run with Docker (Recommended)

The root `docker-compose.yml` starts PostgreSQL/PostGIS (`terrix-db`), the Spring Boot API (`terrix-api`), and the Nginx/React frontend (`terrix-web`) simultaneously. Flyway migrations automatically initialize the schema, spatial indexes, and **demo land lots in Campinas, SP**.

### Prerequisites
- **Docker** and **Docker Compose** installed.

### Step-by-Step
1. Clone the repository and enter the root directory:

       git clone https://github.com/flawbert/terrix.git
       cd terrix

2. Build and start all containers in detached mode:

       docker compose up --build -d

3. Verify that all three containers are running:

       docker compose ps

4. Open the application in your browser:
   - **Frontend Web Application:** http://localhost:3000
   - **Backend REST API:** http://localhost:8080/api/v1/lands
5. To stop the environment:

       docker compose down

---

## 4. How to Run Locally (Without Docker)

If you wish to run the backend and frontend directly on your host machine for development:

### Prerequisites
- **PostgreSQL 16+** with the **PostGIS 3+** extension installed and listening on port `5432` (Database: `terrix_db`, User: `terrix_user`, Password: `terrix_password`). *Tip: You can also run just the database via `docker compose up -d terrix-db`.*
- **Java 21 (JDK 21)** and **Maven 3.9+**.
- **Node.js 20+** and **npm 10+**.

### 1. Run the Backend API

    cd backend
    mvn clean spring-boot:run

The Spring Boot API will run at `http://localhost:8080` and automatically execute Flyway migrations `V1__init_schema.sql` and `V2__seed_demo_data.sql`.

### 2. Run the Frontend Application
Open a second terminal window:

    cd frontend
    npm install
    npm run dev

The Vite development server will start at `http://localhost:5173`.

---

## 5. How to Run Tests & View Code Coverage (>80%)

Both the backend and frontend enforce a minimum **80% code coverage gate** during build verification, currently achieving **~90% on the backend** and **>93% on the frontend**.

### Backend Unit Tests & JaCoCo Coverage Report

    cd backend
    mvn clean verify

- Runs all JUnit 5 & Mockito unit tests covering geometry utilities, validation strategies, services, controllers, RFC 7807 exception handling, and JWT security filters.
- **HTML Coverage Report:** Open `backend/target/site/jacoco/index.html` in your browser.

### Frontend Unit Tests & Vitest/V8 Coverage Report

    cd frontend
    npm run test:coverage

- Runs all Vitest and React Testing Library suites covering geodesic formatters, API service calls, authentication modals, lot creation modals, details popups, proposals inbox, and map toolbar interactions.
- **HTML Coverage Report:** Open `frontend/coverage/index.html` in your browser.

---

## 6. API Endpoints Reference

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/lands` | Public | Returns all registered land lots with GeoJSON polygons and geodesic metrics. |
| `GET` | `/api/v1/lands/{id}` | Public | Returns details of a specific land lot by UUID. |
| `GET` | `/api/v1/lands/search/circle` | Public | Filters lots intersecting a circle (`centerLon`, `centerLat`, `radiusMeters`, optional `maxPrice`, `status`). |
| `POST` | `/api/v1/lands` | Authenticated (JWT) | Validates non-overlapping polygon in PostGIS and registers a new land lot (`201 Created` or `409 Conflict`). |
| `PATCH` | `/api/v1/lands/{id}/status` | Owner (JWT) | Updates land lot status (`AVAILABLE`, `RESERVED`, `SOLD`). |
| `DELETE` | `/api/v1/lands/{id}` | Owner (JWT) | Removes a land lot listing (`204 No Content`). |
| `POST` | `/api/v1/auth/register` | Public | Creates a new user account and returns a signed JWT. |
| `POST` | `/api/v1/auth/login` | Public | Authenticates user credentials and returns a signed JWT. |
| `POST` | `/api/v1/lands/{id}/proposals` | Authenticated (JWT) | Submits a purchase offer (`offeredPrice`, `message`) on an available land lot. |
| `GET` | `/api/v1/proposals/received` | Authenticated (JWT) | Lists all purchase offers received for lots owned by the current user. |
| `PATCH` | `/api/v1/proposals/{id}/evaluate` | Owner (JWT) | Accepts (`accept=true`, reserving the lot) or rejects (`accept=false`) a proposal. |
