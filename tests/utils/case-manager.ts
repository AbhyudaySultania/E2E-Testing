export type MedicineRecord = Record<string, unknown>;
export type InvestigationRecord = Record<string, unknown>;
export type DiagnosisRecord = Record<string, unknown>;
export type MedicalHistorySection = Record<string, unknown>;
export type VitalRecord = Record<string, unknown>;
export type VaccineRecord = Record<string, unknown>;

export type AdviceRecord = Record<string, unknown>;
export type SymptomRecord = Record<string, unknown>;
export type ExaminationRecord = Record<string, unknown>;
export type ModuleContentRecord = Record<string, unknown>;

export type SaveVerificationContext = {
  tcmId: number;
  requestPayload: Record<string, unknown>;
  savedMedicines: MedicineRecord[];
  investigations: InvestigationRecord[];
  diagnoses: DiagnosisRecord[];
  medicalHistory: MedicalHistorySection[];
  vitals: VitalRecord[];
  vaccinesGiven: VaccineRecord[];
  vaccinesDue: VaccineRecord[];
  advice: AdviceRecord[];
  symptoms: SymptomRecord[];
  examinations: ExaminationRecord[];
  moduleContents: ModuleContentRecord[];
  printUrl?: string;
};

export type EndVisitOptions = {
  requireMedicine?: boolean;
  minMedicineCount?: number;
};

function asRecord(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== 'object') return undefined;
  return body as Record<string, unknown>;
}

function unwrapData(body: unknown): Record<string, unknown> | undefined {
  const record = asRecord(body);
  if (!record) return undefined;
  const data = asRecord(record.data);
  return data ?? record;
}

function pickArray<T extends Record<string, unknown>>(
  body: unknown,
  keys: string[],
): T[] {
  const record = asRecord(body);
  const data = unwrapData(body);
  for (const key of keys) {
    const fromRoot = record?.[key];
    if (Array.isArray(fromRoot)) return fromRoot as T[];
    const fromData = data?.[key];
    if (Array.isArray(fromData)) return fromData as T[];
  }
  return [];
}

export function extractMedicinesFromPayload(body: unknown): MedicineRecord[] {
  return pickArray(body, ['medicine', 'medicines']);
}

export function extractInvestigationsFromPayload(
  body: unknown,
): InvestigationRecord[] {
  return pickArray(body, ['investigation', 'investigations']);
}

export function extractDiagnosesFromPayload(body: unknown): DiagnosisRecord[] {
  return pickArray(body, ['diagnosis', 'diagnoses']);
}

export function extractMedicalHistoryFromPayload(
  body: unknown,
): MedicalHistorySection[] {
  return pickArray(body, ['medical_history', 'medicalHistory']);
}

export function extractVitalsFromPayload(body: unknown): VitalRecord[] {
  return pickArray(body, ['vitals', 'vital']);
}

export function extractAdviceFromPayload(body: unknown): AdviceRecord[] {
  return pickArray(body, ['advice', 'advices']);
}

export function extractSymptomsFromPayload(body: unknown): SymptomRecord[] {
  return pickArray(body, ['symptoms', 'symptom']);
}

export function extractExaminationsFromPayload(body: unknown): ExaminationRecord[] {
  return pickArray(body, ['examination', 'examinations']);
}

export function extractModuleContentsFromPayload(
  body: unknown,
): ModuleContentRecord[] {
  return pickArray(body, ['moduleContents', 'module_contents']);
}

export function extractVaccinesFromPayload(body: unknown): {
  given: VaccineRecord[];
  due: VaccineRecord[];
} {
  const record = asRecord(body);
  const data = unwrapData(body);
  const vaccines =
    asRecord(record?.vaccines) ?? asRecord(data?.vaccines) ?? undefined;

  return {
    given: Array.isArray(vaccines?.given) ? (vaccines.given as VaccineRecord[]) : [],
    due: Array.isArray(vaccines?.due) ? (vaccines.due as VaccineRecord[]) : [],
  };
}

export function extractTcmId(body: unknown): number {
  const record = asRecord(body);
  const data = unwrapData(body);

  for (const candidate of [
    record?.tcm_id,
    record?.tcmId,
    data?.tcm_id,
    data?.tcmId,
  ]) {
    const parsed = Number(candidate);
    if (parsed > 0) return parsed;
  }

  return 0;
}

export function extractPrintUrl(body: unknown): string | undefined {
  const record = asRecord(body);
  const data = unwrapData(body);
  for (const candidate of [record?.print_url, data?.print_url, record?.printUrl, data?.printUrl]) {
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  }
  return undefined;
}

export function buildSaveVerificationContext(
  responseBody: unknown,
  requestBody: unknown,
): SaveVerificationContext {
  const payload =
    asRecord(requestBody) ??
    asRecord(responseBody) ??
    ({} as Record<string, unknown>);
  const vaccines = extractVaccinesFromPayload(payload);

  return {
    tcmId: extractTcmId(responseBody),
    requestPayload: payload,
    savedMedicines: extractMedicinesFromPayload(payload),
    investigations: extractInvestigationsFromPayload(payload),
    diagnoses: extractDiagnosesFromPayload(payload),
    medicalHistory: extractMedicalHistoryFromPayload(payload),
    vitals: extractVitalsFromPayload(payload),
    vaccinesGiven: vaccines.given,
    vaccinesDue: vaccines.due,
    advice: extractAdviceFromPayload(payload),
    symptoms: extractSymptomsFromPayload(payload),
    examinations: extractExaminationsFromPayload(payload),
    moduleContents: extractModuleContentsFromPayload(payload),
    printUrl: extractPrintUrl(responseBody),
  };
}

export function adviceContainsName(
  adviceList: AdviceRecord[],
  name: string,
): boolean {
  const normalized = name.trim().toLowerCase();
  return adviceList.some((item) => {
    const adviceName = String(item.advice_name ?? item.name ?? '')
      .trim()
      .toLowerCase();
    return adviceName === normalized;
  });
}

export function symptomsContainName(
  symptoms: SymptomRecord[],
  name: string,
): boolean {
  const normalized = name.trim().toLowerCase();
  return symptoms.some((item) => {
    const symptomName = String(item.symptom_name ?? item.name ?? '')
      .trim()
      .toLowerCase();
    return symptomName === normalized;
  });
}

export function examinationContainsName(
  examinations: ExaminationRecord[],
  name: string,
): boolean {
  const normalized = name.trim().toLowerCase();
  return examinations.some((item) => {
    const examName = String(item.examination_name ?? item.name ?? '')
      .trim()
      .toLowerCase();
    return examName === normalized || examName.includes(normalized) || normalized.includes(examName);
  });
}

export function moduleContentsContainDiet(
  modules: ModuleContentRecord[],
  moduleName: string,
  title: string,
  notes: string,
): boolean {
  const normalizedName = moduleName.trim().toLowerCase();
  return modules.some((module) => {
    const name = String(module.module_name ?? module.name ?? '')
      .trim()
      .toLowerCase();
    if (name !== normalizedName) return false;
    const content = module.content;
    if (!Array.isArray(content)) return false;
    return content.some((row) => {
      const record = row as Record<string, unknown>;
      const rowTitle = String(record.title ?? '').trim();
      const rowNotes = String(record.notes ?? '').trim();
      return rowTitle === title && rowNotes.includes(notes);
    });
  });
}

export function vitalsContainValues(
  vitals: VitalRecord[],
  expected: {
    pulse?: string;
    weight?: string;
    temperature?: string;
    spo2?: string;
    bloodPressure?: string;
  },
): boolean {
  if (!vitals.length) return false;
  const serialized = JSON.stringify(vitals).toLowerCase();
  const checks: boolean[] = [];

  if (expected.pulse) {
    checks.push(
      vitals.some(
        (v) =>
          String(v.pres ?? v.pulse ?? '').includes(expected.pulse!) ||
          serialized.includes(expected.pulse!.toLowerCase()),
      ),
    );
  }
  if (expected.weight) {
    checks.push(
      vitals.some((v) => String(v.weight ?? '').includes(expected.weight!)) ||
        serialized.includes(expected.weight!.toLowerCase()),
    );
  }
  if (expected.temperature) {
    checks.push(
      vitals.some((v) =>
        String(v.temp ?? v.temperature ?? '').includes(expected.temperature!),
      ) || serialized.includes(expected.temperature!.toLowerCase()),
    );
  }
  if (expected.spo2) {
    checks.push(
      vitals.some((v) => String(v.spo2 ?? '').includes(expected.spo2!)) ||
        serialized.includes(expected.spo2!.toLowerCase()),
    );
  }
  if (expected.bloodPressure) {
    checks.push(
      vitals.some((v) =>
        String(v.blood_press ?? v.blood_pressure ?? '').includes(
          expected.bloodPressure!,
        ),
      ) || serialized.includes(expected.bloodPressure!.toLowerCase()),
    );
  }

  return checks.length > 0 && checks.every(Boolean);
}

export function medicineMatchesName(
  medicines: MedicineRecord[],
  brandName: string,
): boolean {
  const normalizedBrand = brandName.trim().toLowerCase();
  if (!normalizedBrand) return false;

  return medicines.some((item) => {
    const name = String(
      item.tmm_medicine_name ?? item.name ?? item.medicine_name ?? '',
    )
      .trim()
      .toLowerCase();

    if (!name) return false;
    return (
      name === normalizedBrand ||
      name.includes(normalizedBrand) ||
      normalizedBrand.includes(name)
    );
  });
}

export function investigationMatchesName(
  investigations: InvestigationRecord[],
  expectedName: string,
): boolean {
  const normalized = expectedName.trim().toLowerCase();
  return investigations.some((item) => {
    const name = String(
      item.investigation_name ?? item.name ?? item.title ?? '',
    )
      .trim()
      .toLowerCase();
    return name === normalized;
  });
}

export function diagnosisMatchesName(
  diagnoses: DiagnosisRecord[],
  expectedName: string,
): boolean {
  const normalized = expectedName.trim().toLowerCase();
  return diagnoses.some((item) => {
    const name = String(item.tds_name ?? item.name ?? item.diagnosis_name ?? '')
      .trim()
      .toLowerCase();
    return name === normalized || name.includes(normalized);
  });
}

export function medicalHistoryContainsCondition(
  sections: MedicalHistorySection[],
  condition: string,
): boolean {
  const normalized = condition.trim().toLowerCase();
  return sections.some((section) => {
    const tags = section.tags;
    if (!Array.isArray(tags)) return false;
    return tags.some((tag) => {
      const title = String(
        (tag as Record<string, unknown>).title ??
          (tag as Record<string, unknown>).name ??
          '',
      )
        .trim()
        .toLowerCase();
      return title === normalized;
    });
  });
}

export function vaccinesGivenContainsLabel(
  vaccines: VaccineRecord[],
  label: string,
): boolean {
  const normalized = label.trim().toLowerCase();
  return vaccines.some((item) => {
    const payload = item.payload as Record<string, unknown> | undefined;
    const vaccine = item.vaccine as Record<string, unknown> | undefined;
    const candidates = [
      item.tvc_name,
      vaccine?.tvc_name,
      item.vaccine_name,
      payload?.vaccine_name,
      vaccine?.tvac_name,
      item.name,
      item.tvac_name,
      item.vaccineName,
      item.label,
    ];
    return candidates.some((candidate) =>
      String(candidate ?? '')
        .trim()
        .toLowerCase()
        .includes(normalized),
    );
  });
}

export function payloadContainsText(
  payload: unknown,
  text: string,
): boolean {
  return JSON.stringify(payload).toLowerCase().includes(text.trim().toLowerCase());
}
