/** Three prescription entry paths exercised by every module regression test */

const ENTRY_PATHS_ALL = [
  'walk-in',
  'patient-details',
  'appointment',
] as const;

export type EntryPath = (typeof ENTRY_PATHS_ALL)[number];

const entryPathFilter = process.env.RX_PAD_ENTRY_PATH?.trim() as
  | EntryPath
  | undefined;

/** Narrow to one path in dev via `RX_PAD_ENTRY_PATH=walk-in` (~3× faster module runs). */
export const ENTRY_PATHS: readonly EntryPath[] =
  entryPathFilter && (ENTRY_PATHS_ALL as readonly string[]).includes(entryPathFilter)
    ? [entryPathFilter]
    : ENTRY_PATHS_ALL;

export const ENTRY_PATH_LABELS: Record<EntryPath, string> = {
  'walk-in': 'Walk-in consultation',
  'patient-details': 'All Patients → patient details → Consult',
  appointment: 'Add Appointment → queue → Consult',
};
