import type { Page } from '@playwright/test';
import { REGRESSION_TEST_DATA } from '../fixtures/regression-test-data';
import type { EntryPath } from '../fixtures/entry-paths';
import { AddAppointmentPage } from '../pages/add-appointment.page';
import { AllPatientsPage } from '../pages/all-patients.page';
import { AppShellPage } from '../pages/app-shell.page';
import { AppointmentQueuePage } from '../pages/appointment-queue.page';
import { DashboardPage } from '../pages/dashboard.page';
import { PatientDetailsPage } from '../pages/patient-details.page';
import { PrescriptionPage } from '../pages/prescription.page';
import { WalkInConsultationPage } from '../pages/walk-in-consultation.page';

export async function navigateToPrescriptionPad(
  page: Page,
  entryPath: EntryPath,
): Promise<PrescriptionPage> {
  const { patient } = REGRESSION_TEST_DATA;
  const appShell = new AppShellPage(page);
  const dashboard = new DashboardPage(page);
  const prescription = new PrescriptionPage(page);

  await dashboard.goto();
  await appShell.assertAuthenticated();
  await appShell.dismissBlockingOverlays();

  if (entryPath === 'walk-in') {
    const walkIn = new WalkInConsultationPage(page);
    await appShell.dismissDashboardBlockers();
    await dashboard.startWalkInConsultation();
    await appShell.dismissBlockingOverlays();
    await walkIn.assertOnWalkInPage();
    await walkIn.searchPatient(patient.searchQuery);
    await walkIn.assertPatientInResults(patient.fullName, patient.mobile);
    await walkIn.startConsultForPatient(patient.fullName);
    await walkIn.assertNavigatedToPrescription();
  } else if (entryPath === 'patient-details') {
    const allPatients = new AllPatientsPage(page);
    const patientDetails = new PatientDetailsPage(page);
    await appShell.dismissBlockingOverlays();
    await allPatients.goto();
    await allPatients.searchPatient(patient.searchQuery);
    await allPatients.openPatientDetails(patient.fullName, patient.mobile);
    await patientDetails.assertOnPatientDetails(patient.fullName);
    await patientDetails.startConsult();
  } else {
    const addAppointment = new AddAppointmentPage(page);
    const queue = new AppointmentQueuePage(page);
    await appShell.dismissBlockingOverlays();
    await addAppointment.goto();
    await addAppointment.selectEarliestAvailableSlot();
    await addAppointment.fillConfirmDrawerAndBook(
      patient.searchQuery,
      patient.fullName,
      patient.mobile,
    );
    const bookedDate = addAppointment.getBookedQueueDate();
    await queue.gotoDashboardQueue();
    await appShell.dismissBlockingOverlays('queue-after-book');
    await queue.startConsultForPatient(
      patient.fullName,
      patient.mobile,
      bookedDate,
    );
  }

  await prescription.assertOnPrescriptionPad();
  await prescription.dismissPillUpTourIfPresent();
  return prescription;
}
