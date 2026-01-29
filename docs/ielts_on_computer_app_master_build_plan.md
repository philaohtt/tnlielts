# IELTS on Computer App – Master Build Plan

## Overview
This document defines the **master build plan** for the IELTS on Computer app. It is intended to be a long-term reference to ensure consistency across all future development chats and phases.

### Core Modules
1. **Test_builder** – Build and manage test content
2. **Test_taker** – Candidate test-taking experience (IDP IELTS on Computer–style UI)
3. **Test_proctor** – Test setup, rules, sessions, and result access
4. **Examiner** – Review attempts and finalize scores

### Build Order (Strict)
1. Test_builder
2. Test_taker
3. Test_proctor
4. Examiner

### Development Principle
For **every module**, follow this order:
1. UI first
2. Functions & logic
3. Database integration

### Supported Environments
- **Offline**: Local devices without Internet (standalone app)
- **Online**: Web app via GitHub Pages

### Storage
- Firestore (primary)
- Offline-first storage with later sync

---

## Phase 0 — Project Foundation
**Goal:** Prepare a stable base for all modules.

- Decide packaging strategy:
  - GitHub Pages (online)
  - Tauri/Electron wrapper (offline standalone)
- Monorepo structure:
  - `/app` – UI + logic
  - `/shared` – schemas, constants, utilities
  - `/adapters` – Firestore + Offline storage adapters
- Define global design system:
  - Layout, typography, buttons
  - Shared UI components (Header, Sidebar, Modal, Table, Toast)

---

## Phase 1 — Global UX & Role Routing (UI)
**Goal:** Full click-through experience with no real data.

- Login page UI
  - Role-based routing (Builder / Proctor / Taker / Examiner)
- Dashboard shells for each role
- Shared app shell:
  - Top bar
  - Side navigation
  - Responsive layout rules

**Deliverable:** Fully navigable UI prototype for all roles.

---

## Phase 2 — Test_builder Module
### 2.1 UI
- Test list
- Create/Edit test metadata
- Question bank management
- Test preview using Test_taker UI

### 2.2 Logic
- Question schema + validation
- Section rules (order, randomization)
- Draft vs Published versions

### 2.3 Storage
- Firestore integration
- Offline save/load
- Sync rules

**Deliverable:** Build tests and preview them as candidates.

---

## Phase 3 — Test_taker Module
### 3.1 UI (IDP-style)
- Candidate home & instructions
- Skill-specific test screens:
  - Listening
  - Reading
  - Writing
- Shared test UI:
  - Timer
  - Question navigator
  - Review flags
  - End-test confirmation

### 3.2 Logic
- Attempt lifecycle (start → autosave → submit)
- Timing engine
- Answer capture
- Resume after interruption

### 3.3 Storage
- Offline-first attempt storage
- Online sync
- Lock attempts after submission

**Deliverable:** Full mock test can be taken offline and synced later.

---

## Phase 4 — Test_proctor Module
### 4.1 UI
- Test session setup
- Candidate management
- Session monitoring
- Result access

### 4.2 Logic
- Session rules & overrides
- Attempt control tools

### 4.3 Storage
- Session data in Firestore
- Offline session support
- Sync later when online

**Deliverable:** Proctors can run and manage test sessions.

---

## Phase 5 — Examiner Module
### 5.1 UI
- Candidate list & filtering
- Attempt review
- Rubric-based scoring
- Score adjustment & comments
- Export/reporting

### 5.2 Logic
- Auto-scoring (objective parts)
- Manual scoring + audit trail
- Finalization & locking

### 5.3 Storage
- Examiner marks in Firestore
- Offline marking with sync

**Deliverable:** Results can be reviewed, adjusted, and finalized.

---

## Phase 6 — Database & Sync Finalization
**Goal:** Lock schema only after UI & logic are stable.

- Finalize collections:
  - Users / Roles
  - Tests
  - Questions
  - Sessions
  - Attempts
  - Scores & audit logs
- Storage abstraction layer
- Conflict handling rules

---

## Phase 7 — Packaging & Deployment
- GitHub Pages deployment
- Standalone Windows build (Tauri/Electron)
- GitHub Actions for automated builds

---

## Phase 8 — QA & Real Test Simulation
- Full test simulations
- Power loss & crash recovery
- Timing accuracy
- Data integrity checks
- Examiner audit verification

---

## Usage Rule Going Forward
- **Each phase is developed in a separate chat**
- This document is the single source of truth
- No schema changes without checking against this plan

