# QA Test Specification — Prescription Happy Path (Walk-in Consultation)

| Field | Value |
|-------|-------|
| **Test ID** | RX-PAD-E2E-001 |
| **Title** | Create and save a new prescription via Walk-in Consultation |
| **Application** | Pm-Doctor-Portal (rx-pad 1.0) |
| **Environment** | UAT |
| **Priority** | P0 — Smoke / Regression |
| **Type** | End-to-end functional |
| **Automation readiness** | Yes (Playwright + authenticated `storageState`) |
| **Source workflow** | `Pm-Doctor-Portal/docs/prescription-happy-path.md` |
| **Author / version** | AI Testing POC — v1.0 |
| **Last updated** | 2026-06-09 |

---

## 1. Objective

Verify that an authenticated doctor can:

1. Locate an existing patient via Walk-in Consultation search
2. Start a new consultation (new `tcmId`)
3. Add prescription data (minimum: one medication)
4. Persist the consultation by clicking **End Visit** (not template Save)
5. Land on the prescription print view with the saved data visible

This test validates the core rx-pad revenue workflow and is the foundation for the AI-assisted E2E regression suite.

---

## 2. Scope

### In scope

- Authentication pre-condition (session already established)
- Dashboard → Walk-in → Patient search → Consult → Rx pad → End Visit → Print view
- Desktop viewport only (1280×720 minimum)
- Single medication as minimum Rx data
- Network-level verification of `addCaseManager` (optional manual/API check)

### Out of scope

- Template Save (`icon-save` in header or Medications box)
- Save as Draft (feature-flagged)
- Edit existing prescription (`tcmId > 0`)
- Print / WhatsApp / download actions on print view
- OPD billing modals post-save
- Zydus-specific ICT order flows (conditional — see §8)
- Mobile / tablet layouts (`TabPrescription`, `MobileWalkInConsultation`)
- Adding patient, editing patient, appointment booking

---

## 3. Preconditions

| # | Precondition | Verification |
|---|--------------|--------------|
| P1 | Valid UAT doctor JWT available | `RX_PAD_JWT` set in `.env`; `auth.setup.ts` completes without error |
| P2 | Authenticated `storageState` generated | `.auth/user.json` exists and is not expired |
| P3 | Test doctor account is **active** (not locked) | Login does not redirect to `/final-setup?isAccountLocked=true` |
| P4 | Test doctor is **not** a Zydus-only locked account on standard UAT | No auto-logout after auth bootstrap |
| P5 | UAT application reachable | `https://pm-uat-doctor-portal.tatvacare.in` responds within 30s |
| P6 | Test patient exists in UAT | Search for `9821885020` returns ≥1 result |
| P7 | Browser viewport is desktop | Width ≥ 1280px, height ≥ 720px |
| P8 | No blocking overlays on dashboard | Dismiss if present: `DocumentVerificationPopup`, `VoiceRxPromoModal`, `ExtendTrialModal` |
| P9 | Medication catalog accessible | `searchMedicine` returns results for test medicine query |
| P10 | Test medicine is a **catalog item** (`tmm_id > 0`) | Not a custom-medicine flow (avoids add-medicine modal) |

### Precondition setup procedure

1. Run `npm run test:setup` in `ai-testing-poc` to refresh `.auth/user.json`
2. Confirm smoke test `authenticated-access.spec.ts` passes
3. Manually verify test patient appears in Walk-in search (one-time sanity check per environment refresh)

---

## 4. Test Data

### 4.1 Environment

| Variable | Value |
|----------|-------|
| `RX_PAD_BASE_URL` | `https://pm-uat-doctor-portal.tatvacare.in` |
| `RX_PAD_JWT` | Valid UAT doctor JWT (from `.env`, not committed) |
| Viewport | 1280 × 720 (desktop) |
| Browser | Chromium (Playwright default) |

### 4.2 Patient (fixed)

| Field | Value |
|-------|-------|
| Full name | Abhyuday Sultania Updated ws |
| Mobile | 9821885020 |
| Search query | `9821885020` |
| Expected match | Exactly one primary result with matching name **and** mobile |

### 4.3 Prescription data (minimum)

| Field | Value | Notes |
|-------|-------|-------|
| Rx section | Medications (Rx) | `tmdpm_id: 12` — must be enabled on doctor's pad |
| Medicine search term | `Para` *(or any catalog medicine returning results)* | Replace with environment-stable medicine if `Para` unavailable |
| Selected medicine | First catalog result with valid `tmm_id` | Must populate `tmm_medicine_name` via `getMedicineDetails` |
| Dosage / frequency / duration | Defaults from API | No manual entry required for happy path |

### 4.4 Expected API payload characteristics (new consult)

| Field | Expected value |
|-------|----------------|
| `action` | `"add"` |
| `tcm_id` | `0` (before save) |
| `patient_unique_id` | Matches selected patient's `patient_unique_id` |
| `medicine` | Array length ≥ 1 |
| `medicine[0].tmm_medicine_name` | Non-empty string |

### 4.5 Dynamic / session data (capture during test)

| Field | Usage |
|-------|-------|
| `tcm_id` (post-save) | Assert `> 0`; store for downstream edit tests |
| `consultation_date` | Assert equals today's date (IST or server TZ) |
| `patient_unique_id` | Cross-check across search → save → print view |

---

## 5. Test Steps

### Phase 0 — Session validation

| Step | Action |
|------|--------|
| 0.1 | Load base URL `/` using authenticated session (`storageState`) |
| 0.2 | Dismiss any blocking modals (verification popup, promos, trial notices) if visible |
| 0.3 | Wait for dashboard shell: header, sidebar, and welcome/appointment area visible |

### Phase 1 — Navigate to Walk-in Consultation

| Step | Action |
|------|--------|
| 1.1 | Locate and click **Start Walk-in Consultation** in the welcome header |
| 1.2 | Confirm URL path is `/walk_in_consultation` |
| 1.3 | Confirm page heading reads **Start Walk-In Consultation** |
| 1.4 | Confirm patient search input is visible with placeholder *"Search by Patient's Name, Phone number or Id"* |

### Phase 2 — Search and select patient

| Step | Action |
|------|--------|
| 2.1 | Click the patient search input |
| 2.2 | Type `9821885020` |
| 2.3 | Wait ≥ 600ms for search debounce (500ms) and API response |
| 2.4 | Confirm autocomplete dropdown displays at least one result |
| 2.5 | Confirm result row contains **Abhyuday Sultania Updated ws** and **9821885020** |
| 2.6 | Initiate consult using **one** of the following (in order of preference): |
|     | **(a)** Click **Start Consult** button on the search result row (when no SmartRx primary) |
|     | **(b)** Click **Consult** on `PrimaryActionButton` (dropdown if SmartRx is primary) |
|     | **(c)** Click patient name → **Patient Selected** modal → click **Consult** |
| 2.7 | If **Patient Selected** modal appears, verify modal shows correct patient name, mobile, and patient ID before proceeding |

### Phase 3 — Prescription pad load

| Step | Action |
|------|--------|
| 3.1 | Confirm navigation to `/prescription` |
| 3.2 | Confirm URL does **not** redirect to `/login` |
| 3.3 | Confirm `HeaderPrescription` toolbar is visible (Templates, Save, End Visit area) |
| 3.4 | Wait for initial API calls to settle (`viewPatient`, `listVitals`, `listPrivateNotes`, `getPatientLastHistory`) |
| 3.5 | Confirm **Medications (Rx)** section is visible on the pad (scroll if below fold) |
| 3.6 | Dismiss PillUp / eaZY Dose tour overlay if it blocks the medication search field |

### Phase 4 — Add medication

| Step | Action |
|------|--------|
| 4.1 | Locate medication search input with placeholder *"Search Medicines by Name"* |
| 4.2 | Type medicine search term (e.g. `Para`) |
| 4.3 | Wait ≥ 600ms for `searchMedicine` debounce and API response |
| 4.4 | Confirm autocomplete dropdown shows ≥1 catalog medicine option |
| 4.5 | Select the first valid catalog medicine (not "Add custom medicine" / `tmm_id === 0`) |
| 4.6 | Wait for `getMedicineDetails` to complete |
| 4.7 | Confirm medication table displays exactly one row with non-empty medicine name |
| 4.8 | Confirm medication search field clears after selection |

### Phase 5 — End visit (save prescription)

| Step | Action |
|------|--------|
| 5.1 | Locate **End Visit** button in prescription header (`icon-exit`, label "End Visit") |
| 5.2 | **Do not** click header **Save** (`icon-save`) — that saves a template only |
| 5.3 | Click **End Visit** once |
| 5.4 | Wait for `addCaseManager` API request to complete (≤ 30s) |
| 5.5 | Observe UI response (toast + navigation) |

### Phase 6 — Print view verification

| Step | Action |
|------|--------|
| 6.1 | Confirm URL is `/prescription_print_view` |
| 6.2 | Confirm page does not redirect to `/login` |
| 6.3 | Wait for `viewCaseManager` API to complete |
| 6.4 | Confirm saved medication name appears in print preview content |
| 6.5 | Confirm print view header / actions area is visible |
| 6.6 | Optionally dismiss OPD billing or monetization overlays if they appear |

---

## 6. Expected Results

### Per-phase outcomes

| Phase | Expected result |
|-------|-----------------|
| 0 | Authenticated dashboard at `/`; `persistant.storage.key.auth-token` present in localStorage |
| 1 | Walk-in consultation page loaded; search input focused/visible |
| 2 | Patient found; consult initiated for Abhyuday Sultania Updated ws |
| 3 | Desktop Rx pad (`Prescription`) loaded; new consult context (`tcmId = 0`) |
| 4 | One medication row added with populated `tmm_medicine_name` |
| 5 | Consultation persisted; success notification shown; navigation to print view |
| 6 | Print view renders saved prescription including added medication |

### API expected results

| API | Method | Expected HTTP | Expected body |
|-----|--------|---------------|---------------|
| `/api/v1/appointment/searchPatient` | POST | 200 | `status: true`; patient list contains test mobile |
| `/api/v1/appointment/viewPatient` | POST | 200 | Patient record returned |
| `/api/v1/medicine/searchMedicine` | POST | 200 | ≥1 medicine in results |
| `/api/v1/medicine/getMedicineDetails` | POST | 200 | Medicine detail object returned |
| `/api/v1/casemanager/addCaseManager` | POST | 200 | `status: true`; `tcm_id > 0` |
| `/api/v1/casemanager/viewCaseManager` | POST | 200 | Saved consultation with medicine array |

### UI expected results (post-save)

| Element | Expected content / state |
|---------|--------------------------|
| Success toast | Contains `{patient_first_name}'s visit ended successfully.` |
| Toast subtext | Contains `View completed visits in finished tab.` |
| Browser URL | `/prescription_print_view` (history replaced, not stacked) |
| Print preview | Selected medication name visible |
| End Visit button | No longer on screen (left prescription page) |

---

## 7. Assertions

Assertions are ordered by priority. **P0** assertions are mandatory for test pass; **P1** are recommended; **P2** are informational.

### 7.1 Authentication & navigation (P0)

| ID | Assertion |
|----|-----------|
| A-01 | Current URL does not match `/login` at any point after Phase 0 |
| A-02 | `localStorage['persistant.storage.key.auth-token']` parses to a JWT string starting with `eyJ` |
| A-03 | After Phase 1, URL path is `/walk_in_consultation` |
| A-04 | After Phase 3, URL path is `/prescription` |
| A-05 | After Phase 6, URL path is `/prescription_print_view` |

### 7.2 Patient search (P0)

| ID | Assertion |
|----|-----------|
| A-06 | Search input accepts `9821885020` without validation error |
| A-07 | Autocomplete results include patient name **Abhyuday Sultania Updated ws** |
| A-08 | Autocomplete results include mobile **9821885020** |
| A-09 | Selected patient initiates navigation toward `/prescription` |

### 7.3 Prescription pad (P0)

| ID | Assertion |
|----|-----------|
| A-10 | `HeaderPrescription` toolbar visible (contains End Visit control) |
| A-11 | Medications (Rx) section heading visible |
| A-12 | Medication table row count = 1 after Phase 4 |
| A-13 | Medication row displays non-empty medicine name matching selected catalog item |

### 7.4 Save / End Visit (P0)

| ID | Assertion |
|----|-----------|
| A-14 | `POST /api/v1/casemanager/addCaseManager` request fired after End Visit click |
| A-15 | `addCaseManager` response `status` is `true` |
| A-16 | `addCaseManager` response contains `tcm_id` where `tcm_id > 0` |
| A-17 | `addCaseManager` request body `action` equals `"add"` |
| A-18 | `addCaseManager` request body `medicine` array length ≥ 1 |
| A-19 | Success toast with visit-ended message is displayed (≤ 10s after End Visit) |
| A-20 | User is **not** still on `/prescription` after successful save |

### 7.5 Print view (P0)

| ID | Assertion |
|----|-----------|
| A-21 | `POST /api/v1/casemanager/viewCaseManager` request fired on print view load |
| A-22 | Saved medication name visible in print preview DOM |
| A-23 | Print view header (`HeaderPrescriptionPrint` area) is visible |

### 7.6 Negative guards (P1)

| ID | Assertion |
|----|-----------|
| A-24 | Clicking header **Save** (`icon-save`) alone does **not** navigate to print view |
| A-25 | End Visit with empty medication table does not trigger `addCaseManager` |
| A-26 | No error toast containing `Please fillup medication name` after valid medicine selection |

### 7.7 Data integrity (P1)

| ID | Assertion |
|----|-----------|
| A-27 | `patient_unique_id` in `addCaseManager` payload matches patient from search result |
| A-28 | `consultation_date` in payload matches current date (±0 days) |
| A-29 | `viewCaseManager` response includes medicine array with same `tmm_medicine_name` |

### 7.8 Performance thresholds (P2)

| ID | Assertion |
|----|-----------|
| A-30 | Patient search results appear within 5s of typing |
| A-31 | `addCaseManager` completes within 30s |
| A-32 | Print view content renders within 15s of navigation |

---

## 8. Failure Conditions

Test is marked **FAILED** if any P0 assertion fails or any condition below occurs.

### 8.1 Hard failures (immediate fail)

| Code | Condition | Likely cause |
|------|-----------|--------------|
| F-01 | Redirect to `/login` during test | Expired JWT; invalid `storageState` |
| F-02 | Redirect to `/final-setup?isAccountLocked=true` | Doctor account locked |
| F-03 | Patient search returns zero results for `9821885020` | Patient deleted/archived in UAT |
| F-04 | Wrong patient selected (name or mobile mismatch) | Ambiguous search results |
| F-05 | `/prescription` loads without patient context (blank/error state) | Router state lost; direct URL navigation |
| F-06 | Medication search returns zero results for test query | Catalog/API outage; wrong search term |
| F-07 | Custom medicine modal opens instead of catalog selection | Selected `tmm_id === 0` entry |
| F-08 | Medication row not added after selection | `getMedicineDetails` API failure |
| F-09 | End Visit click does not fire `addCaseManager` | Empty Rx pad; wrong button clicked (Save vs End Visit) |
| F-10 | `addCaseManager` returns `status: false` or HTTP ≥ 400 | Backend validation; service outage |
| F-11 | `tcm_id` missing or `≤ 0` in `addCaseManager` response | Save did not persist |
| F-12 | Error toast: `Please fillup medication name` | Incomplete medication row |
| F-13 | No navigation to `/prescription_print_view` within 30s of End Visit | Network timeout; unhandled JS error |
| F-14 | Success toast not displayed | UI regression; message component failure |
| F-15 | Saved medication not visible on print view | `viewCaseManager` failure; render regression |
| F-16 | Unhandled modal blocks End Visit or medication entry | PillUp tour, verification popup, promo modal |

### 8.2 Soft failures (fail with defect ticket — P1)

| Code | Condition | Action |
|------|-----------|--------|
| F-17 | `orderMedicineAndInvestigation` fails post-save | Log warning; core save may still pass |
| F-18 | OPD billing modal blocks print view | Dismiss and re-assert; file UI defect if recurring |
| F-19 | PillUp tour appears but is dismissable | Dismiss and continue; file UX defect |
| F-20 | Search debounce causes flaky result timing | Increase wait; file timing defect if persistent |
| F-21 | Primary action button label is SmartRx/Voice Rx instead of Consult | Use dropdown Consult option; file test data note |

### 8.3 Abort conditions (stop test, fix environment)

| Code | Condition | Action |
|------|-----------|--------|
| F-30 | UAT base URL unreachable | Abort suite; check VPN/network |
| F-31 | `.auth/user.json` missing or corrupt | Re-run `npm run test:setup` |
| F-32 | `RX_PAD_JWT` not set or placeholder value | Update `.env` |
| F-33 | Test doctor lacks Medications module on customized pad | Change test doctor or enable module |
| F-34 | Viewport < 1280px (mobile layout active) | Fix Playwright viewport config |

---

## 9. Test Tags & Execution

| Tag | Purpose |
|-----|---------|
| `@smoke` | Run on every PR |
| `@p0` | Critical regression |
| `@prescription` | Prescription domain filter |
| `@walk-in` | Entry path filter |
| `@uat` | UAT environment only |

### Recommended execution order in CI

```
1. project: setup   → auth.setup.ts
2. authenticated-access.spec.ts  → session smoke
3. prescription-happy-path.spec.ts (future) → this spec
```

### Retry policy

| Scenario | Retries |
|----------|---------|
| Network timeout on `addCaseManager` | 1 retry |
| Search autocomplete timing | 1 retry |
| Auth redirect to `/login` | 0 retries — refresh JWT first |
| Wrong patient selected | 0 retries — data defect |

---

## 10. Traceability

| Workflow step (`prescription-happy-path.md`) | Test step | Assertion IDs |
|---------------------------------------------|-----------|---------------|
| Authenticate → `/` | Phase 0 | A-01, A-02 |
| Start Walk-in Consultation | Phase 1 | A-03 |
| Search `9821885020` | Phase 2 | A-06, A-07, A-08 |
| Start Consult | Phase 2.6 | A-04, A-09 |
| Add medication | Phase 4 | A-11, A-12, A-13 |
| End Visit | Phase 5 | A-14–A-20 |
| Print view | Phase 6 | A-05, A-21–A-23 |

---

## 11. Notes for Test Engineers

1. **End Visit ≠ Save.** The header Save button persists a **template** via `oneClickAddTemplate`. Only **End Visit** calls `addCaseManager` and completes the consultation.

2. **Router state is required.** Never navigate directly to `/prescription` without going through Walk-in → Consult. The page expects `patient_data` in React Router state.

3. **Feature flags change the consult button.** If SmartRx is enabled, the primary row button may be "SmartRx" — use the dropdown chevron to select **Consult**.

4. **Medicine selection must be from catalog.** Custom medicines (`tmm_id === 0`) open an add-medicine modal and add complexity. Use a known catalog term stable in UAT.

5. **Capture `tcm_id` on success.** Store for future edit-prescription test cases (RX-PAD-E2E-002).

6. **Do not assert on MoEngage/analytics events.** They are non-blocking and may be blocked in test browsers.

---

## 12. Revision History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-09 | Initial spec derived from `prescription-happy-path.md` |
