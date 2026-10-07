# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

npm workspaces monorepo (see the root `CLAUDE.md`):

- `apps/web`: Next.js 16 (App Router) + React 19 + TypeScript + Ant Design 6 (theme tokens in `packages/ui/src/theme.ts`), port 3001.
- `apps/api`: Node.js + Express + Swagger, port 3000. It is the only path to the data.
- `packages/ui` (`@rentar/ui`, the design system, synced with Claude Design) and `packages/shared-types`.
- Supabase: Postgres (schema in `supabase/migrations/`) and Auth. The front uses Supabase only for the session; it never queries tables directly.

The front runs in two modes (`NEXT_PUBLIC_USE_MOCKS`): mock (the shared cast in `apps/web/src/lib/mocks/`, no backend) and real (`apps/api` + Supabase Auth). It started as a Vite + Tailwind landing prototype, later migrated to Next.js/Ant Design; that earlier repo is kept only as history.

## Users

Three profiles, per the source academic study (RentAR — Estudio Inicial, UTN FRC, Seminario Integrador 2026):

- **Locador particular**: owns 1-5 rental units, manages them personally, basic-to-intermediate digital literacy. Cannot justify the cost of professional property-management software or a real-estate agency.
- **Locatario**: long-term tenant, strong student segment (non-local population moving to Córdoba) plus young professionals. High digital literacy, comfortable with electronic payments.
- **Garante**: guarantor backing the tenant's lease, frequently living in a different city; needs to sign remotely.

## Product Purpose

RentAR centralizes the full lifecycle of a long-term residential rental agreed directly between landlord and tenant, with no real-estate agency: publish the property, search, apply, sign the contract electronically, calculate the periodic rent adjustment automatically, collect/register payments, handle claims, and close/republish the listing. Success = full traceability of the contract and payments for both parties, and a much lower cost/friction of remote contracting than the traditional agency path.

This repository is the team's monorepo for that product, built for a university capstone (UTN FRC, Seminario Integrador 2026): the web front, the API and the Supabase schema. Sprint 1 covers the public landing and search, sign-up and login, the landlord panel, "Mis propiedades" and the listing wizard; the rest of the lifecycle arrives in later sprints.

## Positioning

Every competitor covers the process only partially (see the source study's comparison table): ARquiler only calculates the index adjustment; Argenprop/ZonaProp only publish and search; TusAlquileres only administers for real-estate agencies; Roomix only searches with AI; Airbnb solves remote contracting but only for short-term/furnished stays. None combine publish + search + sign + adjust + collect + administer for long-term residential rentals between individuals — that combination is RentAR's mechanism.

## Operating Context

Pilot market: Córdoba Capital, Argentina, with a strong seasonal student-driven demand spike (Dec-March). Mock neighborhoods used throughout: Nueva Córdoba (high-demand, $550k-610k/month for a 1-bedroom), Güemes, Centro, General Paz, Cofico, Alta Córdoba (~$445k-505k/month), 2026 reference values. Rent adjustment indices are IPC (INDEC) or ICL (BCRA), the two indices legally used for Argentine rental contracts.

## Capabilities and Constraints

- Authentication (Supabase Auth) and persistence (`apps/api` + Postgres) are real. Payments, e-signature and the contract flows are not built yet; where they appear, they are shown as simulated (`SimulatedFeatureNotice`), never as working features.
- Current routes: `/` (landing: search, recent listings, neighborhoods, how it works and a call to publish), `/buscar` (search with filters, US-34), `/login`, `/registro`, `/panel`, `/panel/propiedades` and `/panel/propiedades/nueva`. Other destinations (the public property page, contracts, payments, claims…) are "En construcción" placeholders until their sprint (see `apps/web/README.md`).
- Still to come, per the source study: Vercel (hosting), MercadoPago (payments), Gemini (contract-analysis assistant) and a to-be-defined e-signature mechanism.
- Only long-term unfurnished residential rentals are in scope; temporary/tourist rentals, furnished seasonal rentals, and corporate portfolios are explicitly out of scope.
- Browsers: current Chrome, Firefox, Safari, desktop and mobile (RNF-01/02). Must stay responsive across mobile/tablet/desktop and lightweight on mobile connections (RNF-12).

## Brand Commitments

- Name: **RentAR**. Logo: `packages/ui/src/assets/logo-rentar.svg` (primary, house isotype + wordmark) used in header/footer; favicon in `apps/web/src/app/icon.svg`.
- Palette (fixed, from the project's brand sheet): blue `#004D98` (primary), gold `#D7B15D` (accent), sky blue `#A0D1EF` (secondary).
- Typeface: **League Spartan** (loaded via Google Fonts) for all UI text.
- Voice: Rioplatense Spanish, clear, warm, trustworthy — not corporate/stiff. Copy already written throughout the shipped components.

## Evidence on Hand

- Full source document read and used as ground truth: `../Recursos/RentAR - Estudio Inicial (rev.1 corregido).pdf` (24 pages: market/user research, competitor comparison table, functional/non-functional requirements RG/RD/RNF, feasibility study, Scrum roadmap).
- Competitor structure reference (layout patterns only, never copied verbatim): saved Argenprop and ZonaProp homepages under `../Recursos/EjemplosCompetencia/`.
- Property photos are stock images (Unsplash) chosen to match modest/mid-range apartments, PHs, and houses — not aspirational mansions — curated by hand across two rounds of feedback.
- No real testimonials, pricing, or case studies exist or should be fabricated; this is an academic prototype.

## Product Principles

1. Directness over intermediation: every design decision should reinforce "trato directo con el dueño" (no agency) as the core differentiator.
2. Prototype honesty: never fake a working backend feature (auth, payments, signature) as if it were real; placeholders must read as placeholders, not broken features.
3. Keep it light: this is explicitly meant to be a lean landing, not the full product surface — depth belongs in a future dedicated page, not crammed into this one.
4. Respect the source study's requirements (RD-06 filters, RNF-02 responsive, RNF-10 usability for non-technical landlords, RNF-12 mobile performance) as hard constraints, not suggestions.

## Accessibility & Inclusion

RNF-10 explicitly targets a non-technical landlord persona: forms and primary actions must be understandable without technical knowledge. Contrast verified ≥4.5:1 for all body/UI text, visible keyboard focus (brand-blue outline), semantic form structure (labels, fieldset/legend), and `prefers-reduced-motion` respected globally and in the custom motion pieces (the "Cómo funciona" loop and the on-scroll reveals of the landing).
