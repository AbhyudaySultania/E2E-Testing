# RX-PAD Regression — Test Data & Verification Summary

UAT target: `https://pm-uat-doctor-portal.tatvacare.in`  
Test patient: **Abhyuday Sultania Updated ws** / **9821885020**

Every module spec (E2E-002 → E2E-010) runs **three entry paths** and ends with **Edit prescription + Repeat Rx**.  
E2E-011 (mega test) is walk-in only.

---

## How pass / fail is decided

| Layer | What it checks | Failure signal |
|-------|----------------|----------------|
| **Pad UI** | Module values visible on Rx pad after entry (and after Repeat Rx) | Playwright `expect` timeout / mismatch |
| **Save API** | `POST addCaseManager` or `editCaseManager` returns success, `tcm_id > 0` | HTTP non-200, missing `tcm_id`, payload field missing |
| **Print preview (legacy)** | `addCaseManager` body + `viewCaseManager` contain expected strings; lab GET for lab results | `assertSaveAndPreview` assertion |
| **Print preview (PDF)** | PDF blob extracted via react-pdf + `pdfjs-dist`; text must include expected strings | `assertPdfContains` — string not found in PDF text |
| **Edit flow** | Print view → Edit → add **Avoid cold drinks** advice → End visit again | Same save + preview checks as above |
| **Repeat Rx** | Patient details → select saved `tcm_id` → Repeat Rx → pad pre-fill | `assertRepeatRxPrefill` — module fields not on pad |
| **Skip** | Module not enabled for doctor account | `test.skip()` — recorded in `test-results/skip-report.json` |

A test **passes** when all steps complete without assertion failure or unexpected skip.  
A test **fails** when any Playwright `expect` fails (report + screenshot on failure).

---

## Shared edit + repeat data

| Field | Value | Used in |
|-------|-------|---------|
| Edit advice | **Avoid cold drinks** | All E2E-002 → E2E-010 after first save |
| Repeat Rx navigation | Same patient → consultation by saved `tcm_id` | All module specs |

**Repeat Rx note:** Vaccination does **not** pre-fill on Repeat Rx (app behaviour). Vaccination spec only asserts edit advice on the pad after repeat.

---

## Per-test data & verification

### E2E-002 — Multi-medicine (`multi-medicine.spec.ts`)

| Data entered | Para (search `Para`) + Azithral (search `Azithral`) |
| First save verify | `medicine[]` in API; preview has both brand names |
| Edit verify | Preview: both meds + Avoid cold drinks |
| Repeat verify | Both meds + Avoid cold drinks on pad |

### E2E-003 — Investigation (`investigation.spec.ts`)

| Data entered | LAP/NAP Score Test (search `LAP`) |
| First save verify | `investigation_name` in API; preview has full catalog name |
| Edit verify | Preview: investigation + Avoid cold drinks |
| Repeat verify | Display label **Leucocyte Alkaline Phosphatase** + advice on pad |

### E2E-004 — Medical history (`medical-history.spec.ts`)

| Data entered | **Asthama** under Medical Condition |
| First save verify | `medical_history[]` tags in API |
| Edit verify | Preview: Asthama + Avoid cold drinks |
| Repeat verify | Asthama visible in module box + advice on pad |

### E2E-005 — Vaccination (`vaccination.spec.ts`)

| Data entered | IAP **HB 1**, brand **Bevac**, site **Left Arm** |
| First save verify | `vaccines.given[]` in API; PDF contains vaccine, brand, site |
| Edit verify | PDF: HB 1, Bevac, Avoid cold drinks |
| Repeat verify | **Advice only** on pad (vaccination not pre-filled) |

### E2E-006 — Lab results (`lab-results.spec.ts`)

| Data entered | Haemoglobin (CBC drawer); value **12.0–16.4** (dynamic, based on timestamp) |
| First save verify | `lab-parameters/results` POST + GET on print view |
| Edit verify | Preview: saved Hb value + Avoid cold drinks |
| Repeat verify | Hb value in Lab Results box + advice on pad |

### E2E-007 — Diagnosis (`diagnosis.spec.ts`)

| Data entered | Search `dengue` → **Dengue hemorrhagic fever** |
| First save verify | `diagnosis[]` → `tds_name` in API |
| Edit verify | Preview: diagnosis + Avoid cold drinks |
| Repeat verify | Diagnosis row on pad + advice |

### E2E-008 — Vitals (`vitals.spec.ts`)

| Data entered | BP **120/80**, pulse **72**, weight **70**, temp **98.6**, SpO2 **98** |
| First save verify | `vitals[]` in API; PDF contains BP, pulse, weight, temp, SpO2 |
| Edit verify | PDF: pulse + Avoid cold drinks |
| Repeat verify | All vitals input values on pad + advice |

### E2E-009 — Advice (`advice.spec.ts`)

| Data entered | **Rest**, **Plenty of fluids** |
| First save verify | `advice[]` in API; PDF contains both strings |
| Edit verify | PDF: all three advice lines |
| Repeat verify | Rest, Plenty of fluids, Avoid cold drinks on pad |

### E2E-010 — Diet (`diet.spec.ts`)

| Data entered | Title **Protein**, notes **35 gm at least** |
| First save verify | `moduleContents` in API; PDF contains title + notes |
| Edit verify | PDF: diet fields + Avoid cold drinks |
| Repeat verify | Diet combobox + notes on pad; Avoid cold drinks on pad |

### E2E-011 — Full consultation (`full-consultation.spec.ts`, walk-in only)

| Data entered | Vitals + advice (2) + diet + HB 1 vaccination |
| First save verify | Full API payload + PDF for all modules |
| Edit verify | PDF after adding Avoid cold drinks |
| Repeat verify | Vitals, all advice lines, diet on pad (no vaccination) |

---

## Entry paths (all module specs except E2E-011)

1. **Walk-in** — Dashboard → Start Walk-in → search patient → Consult  
2. **Patient details** — All Patients → open patient → Consult  
3. **Appointment** — Add Appointment → book slot → Queue → Consult  

---

## Commands

```bash
cd ai-testing-poc
npm run test:regression              # full suite
npm run test:regression:vitals       # single module
npx playwright show-report           # HTML report after run
```

---

## Result artifacts

| File | Purpose |
|------|---------|
| `playwright-report/index.html` | Per-step pass/fail, traces, screenshots |
| `test-results/skip-report.json` | Modules skipped (not visible for account) |
| `test-results/blocker-log.json` | UI blockers dismissed during run (self-healing Phase A) |

See `docs/self-healing.md` for blocker registry and `clickResilient` usage.
