# RX-PAD Regression Suite Expansion

Local Playwright regression for rx-pad 1.0 (UAT). Module tests use **full Playwright**; ZeroStep is limited to **navigation + walk-in consult** paths.

## Test matrix

| ID | Spec | Module | Entry paths (each) |
|----|------|--------|-------------------|
| E2E-002 | `tests/regression/multi-medicine.spec.ts` | Para + Azithral (`medicine.length >= 2`) | walk-in, patient-details, appointment |
| E2E-003 | `tests/regression/investigation.spec.ts` | Leucocyte Alkaline Phosphatase (LAP) / Neutrophil Alkaline Phosphatase (NAP) Score Test | walk-in, patient-details, appointment |
| E2E-004 | `tests/regression/medical-history.spec.ts` | Asthma under Medical Condition | walk-in, patient-details, appointment |
| E2E-005 | `tests/regression/vaccination.spec.ts` | Rabies Dose 1 (`vaccines.given[]`) | walk-in, patient-details, appointment |
| E2E-006 | `tests/regression/lab-results.spec.ts` | Lab drawer → save parameter | walk-in, patient-details, appointment |
| E2E-007 | `tests/regression/diagnosis.spec.ts` | dengue (full string match) | walk-in, patient-details, appointment |

**NAV (ZeroStep):** `tests/nav/walk-in-consult-zerostep.spec.ts` — dashboard → walk-in → consult only.

## Entry paths

1. **walk-in** — Dashboard → Start Walk-in → search → Consult (SmartRx split when needed)
2. **patient-details** — `/all_patients` → search → patient row → Consult on Welcome1
3. **appointment** — `/add-appointment` → earliest available slot → Book → Queue tab → Consult

Shared helper: `tests/helpers/navigate-to-prescription.ts`

## Assertions

### Save (all module tests)

- `POST /api/v1/casemanager/addCaseManager` — request body fields per module
- `tcm_id > 0` in response
- Navigation to `/prescription_print_view`

### Print preview

PDF body is canvas-rendered (`renderTextLayer={false}`). Preview checks use:

1. **addCaseManager request payload** (print source data)
2. **viewCaseManager** response when the print view loads
3. **GET lab-parameters/results** on print view for lab tests
4. Canvas visible on print view (PDF rendered)

Per-module preview expectations are passed via `assertSaveAndPreview()` in `prescription-print-view.page.ts`.

## Skip handling (option A)

When a module is not visible for the account (or Rabies Dose 1 not in chart), tests call `test.skip()` with a reason. The custom reporter writes aggregates to:

`test-results/skip-report.json`

## APIs

| Module | Search / action API | Save payload key |
|--------|---------------------|------------------|
| Medications | `POST /api/v1/medicine/searchMedicine` | `medicine[]` → `tmm_medicine_name` |
| Investigation | `POST /api/v1/investigation/search` | `investigation[]` → `investigation_name` |
| Diagnosis | `POST /api/v1/diagnosis/search` | `diagnosis[]` → `tds_name` |
| Medical history | `POST …/medicalhistory/addTag` | `medical_history[]` → `tags[].title` |
| Vaccination | UI → Redux `givenVaccines` | `vaccines.given[]` |
| Lab results | `POST /api/v1/lab-parameters/results` | print: GET same + `labParamsData` state |
| Vitals | `POST /api/v1/vital/addVitals` | `vitals[]` |

## npm scripts

```bash
npm run test:regression              # all module specs (18 tests = 6 × 3 paths)
npm run test:regression:medications
npm run test:regression:investigation
npm run test:regression:diagnosis
npm run test:regression:medical-history
npm run test:regression:vaccination
npm run test:regression:lab-results
npm run test:nav:zerostep            # requires ZEROSTEP_TOKEN
```

## Test patient

- Name: Abhyuday Sultania Updated ws
- Mobile: `9821885020`
- Auth: `RX_PAD_AUTH_TOKEN` in `.env` (see `auth.setup.ts`)

## Known risks

- **Appointment path** depends on available slots (today/tomorrow) and queue state; may flake if slot booking fails.
- **Vaccination** skips when Rabies Dose 1 is not in chart for patient age.
- **Lab results** UI uses dynamic tables; fallback input locator may need tuning per account.
- **MoEngage / document verification** banners — dismissed via `AppShellPage.dismissBlockingOverlays()`.
- **No previously prescribed alerts** expected for Para/Azithral in current UAT data.

## Module IDs (reference)

Investigation=14, Diagnosis=11, Meds=12, Vitals=1, Medical History=3, Vaccination=7, Lab Results=19
