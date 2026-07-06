# ZeroStep Selector Mapping — RX-PAD-E2E-001

**Test files:**
- Playwright (deterministic actions): `tests/create-prescription.spec.ts`
- ZeroStep hybrid (AI actions): `tests/create-prescription-zerostep.spec.ts`

**Pattern:** ZeroStep replaces **interactions** only. All **assertions** remain in Playwright page objects for deterministic CI verification.

---

## Summary

| Category | Playwright locators | ZeroStep `ai()` prompts | Maintenance reduction |
|----------|:-------------------:|:-----------------------:|:---------------------:|
| Overlay dismissal | 5 selector strategies | Playwright (CDP-safe) | **High** |
| Walk-in navigation | 2 locators + fallback URL | Playwright only (MoEngage CDP) | **Medium** |
| Patient search | 1 placeholder locator | 1 prompt | **Low** |
| Patient result + consult | 8+ conditional locators | 2 prompts | **High** |
| Medication search + select | 4+ dropdown locators | 2 prompts + 2 queries | **High** |
| End Visit click | 2-part button filter | Playwright only (avoid Dose Calculator misclick) | **Medium** |
| All assertions | 20+ locators/API checks | **Unchanged (Playwright)** | N/A |

**Estimated locator maintenance reduction:** ~60% of interaction code (overlay, consult flows, medication autocomplete).

---

## Phase 0 — Session validation

| Step | Playwright | ZeroStep | Assertion preserved |
|------|------------|----------|---------------------|
| Navigate dashboard | `page.goto('/')` | Same (deterministic) | `assertOnDashboard()` — URL + heading |
| Auth check | `localStorage` evaluate | Same | `assertAuthenticated()` — JWT in localStorage |
| Shell visible | `header, .ant-layout, nav` | Same | `assertMainShellVisible()` |
| Dismiss overlays | See below | **AI** | N/A (setup) |

### Overlay dismissal — Playwright (not AI)

ZeroStep `ai()` click fails on the monetization popup close (`img` without CDP content quads → `getContentQuads` throws). Overlays use deterministic `AppShellPage.dismissBlockingOverlays()` including the premium dialog.

| Playwright selector | Notes |
|---------------------|-------|
| `[id^="moe-onsite-campaign"]` close img / top-right click / DOM remove | MoEngage banner intercepts Walk-in; loads async after dashboard |
| `getByRole('button', { name: /do later/i })` | Document verification |
| `.ant-modal-close` | Generic modals |
| `getByRole('button', { name: /^okay$/i })` | Tours |
| `getByRole('button', { name: /not now\|maybe later\|skip\|dismiss\|close/i })` | Dismiss CTAs |
| `.ant-tour-close, .ant-popover-close` | Ant Design tours |

**Maintenance win:** One `dismissBlockingOverlays()` helper shared by Playwright and ZeroStep specs.

---

## Phase 1 — Walk-in consultation

| Playwright | ZeroStep |
|------------|----------|
| `getByRole('button', { name: /start walk-in/i })` | **Playwright only** — MoEngage `svg[data-name="close-popup"]` breaks ZeroStep |
| `dismissDashboardBlockers()` before click | `dismissMoEngagePremiumBanner()` + `dismissDocumentVerificationPopup()` |
| Fallback: `page.goto('/walk_in_consultation')` | Same |

**Assertion preserved:** `assertOnWalkInPage()` — URL `/walk_in_consultation` + heading + search input placeholder.

---

## Phase 2 — Patient search & consult

### Patient search

| Playwright | ZeroStep |
|------------|----------|
| `getByPlaceholder(/search by patient.*name.*phone.*id/i)` | `In the patient search field... type "{query}"` |

**Assertion preserved:** `assertPatientInResults()` — scoped dropdown row with name + mobile (strict mode safe).

### Start consult — highest maintenance area

| Playwright selector / branch | ZeroStep |
|------------------------------|----------|
| `.walkincomplete` → `getByRole('button', { name: /start consult/i })` | |
| `.walkincomplete` → `getByRole('button', { name: /^consult$/i })` | AI prompt + Playwright fallback if URL still walk-in |
| `.btn-smart-rx-walkin` → `.consult-btns-group .icon-right` → Consult menu | SmartRx primary — Consult is in chevron dropdown |
| Patient Selected modal → same SmartRx split flow | Modal may already be open after ZeroStep |

**Assertion preserved:**
- `assertPatientInResults(fullName, mobile)`
- `assertNavigatedToPrescription()` — URL `/prescription`

**Maintenance win:** SmartRx / VoiceRx / modal variants collapse into one NL instruction.

---

## Phase 3 — Prescription pad

| Playwright | ZeroStep |
|------------|----------|
| `getByRole('button', { name: /^okay$/i })` (PillUp tour) | `If PillUp tour... click Okay` |

**Assertions preserved:**
- `assertOnPrescriptionPad()` — URL + End Visit button visible
- `assertMedicationsSectionVisible()` — `Medications (Rx)` heading

---

## Phase 4 — Add medication

| Playwright | ZeroStep |
|------------|----------|
| `getByPlaceholder(/search medicines by name/i)` | `Click "Search Medicines by Name" and type "{term}"` |
| `.medicine-parent-autocomplete-dropdown .ant-select-item-option` | `Select first valid catalog medicine...` |
| `innerText()` parse for brand/composition | AI query for brand name + composition |

**Assertions preserved (deterministic):**
- `expect(selectedMedicine.brandName.length).toBeGreaterThan(0)`
- `assertMedicationAdded()` — brand + composition in `main` meds section, search input cleared

**Maintenance win:** Dropdown class changes (`ant-select` vs `rc-virtual-list`) and option text format (`Tablet, Salt` vs `Tablet Salt`) handled by AI at runtime.

---

## Phase 5 — End Visit

| Playwright | ZeroStep |
|------------|----------|
| `button.filter({ has: .icon-exit }).filter({ hasText: /end/i })` | `Click End Visit (not Save, not Save as Draft)` |

**Assertions preserved (API + navigation — no AI):**
- `endVisitAndWaitForSave()` — `addCaseManager` POST 200, `data.tcm_id > 0`, medicine payload
- `expect(saveContext.tcmId).toBeGreaterThan(0)`
- `assertSaveSuccessToast()` — visit ended message (skipped if already on print view)

---

## Phase 6 — Print view

**No ZeroStep** — print preview uses react-pdf canvas (`renderTextLayer={false}`). Medication is verified via API payload, not DOM text.

| Assertion | Method | Why kept deterministic |
|-----------|--------|------------------------|
| URL `/prescription_print_view` | `assertOnPrintView()` | Stable route |
| PDF canvas rendered | `waitForConsultationLoad()` | `.react-pdf__Page canvas` |
| Patient in header | `assertPatientContextVisible()` | `.patientName` |
| Medicine in save payload | `assertMedicationSaved()` | `addCaseManager` / `viewCaseManager` API |
| Print shell | `assertPrintShellVisible()` | Print Prescription / Preview buttons |

---

## What stays Playwright (and why)

| Concern | Reason |
|---------|--------|
| JWT / localStorage auth | Security-critical; no AI variance |
| URL route assertions | Deterministic navigation contract |
| API `waitForResponse` | Auditable save verification (`tcm_id`, medicine array) |
| Print view canvas check | ZeroStep cannot read canvas pixels reliably |
| CI regression stability | Assertions must not consume ZeroStep API quota |

---

## Running the ZeroStep variant

```bash
# Add to .env
ZEROSTEP_TOKEN=your-token-here

npm run test:prescription:zerostep
```

Free tier: 500 `ai()` calls/month. This test uses ~10–12 calls per run.

---

## Hybrid recommendation for production

```
Deterministic Playwright     ZeroStep ai() + fallback
────────────────────────     ────────────────────────
Auth setup (seed)            Overlay dismissal (Playwright only — CDP quads)
URL assertions               Walk-in CTA
API save verification        Patient consult start
Print view API/canvas        Medication search + select
PillUp tour dismiss          End Visit click
```

**CDP fallback:** `tests/utils/zerostep-safe.ts` catches `getContentQuads` failures and runs the Playwright page-object equivalent.

This matches the POC recommendation: Playwright primary + ZeroStep for brittle UI flows.
