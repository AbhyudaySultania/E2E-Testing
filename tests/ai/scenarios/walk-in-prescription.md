# Walk-in prescription — add medication and end visit

Natural-language steps are executed at runtime by **Midscene** (vision + NL), including scrolling when content is below the fold.
Only the `## Verify` block and post-Complete URL navigation use deterministic Playwright checks.

## Steps

1. Dismiss any premium popups, tours, or chat widgets blocking the dashboard
2. Open the Walk-In Consultation page using the Start Walk-in button on the dashboard (not the appointments queue search)
3. In the walk-in patient search combobox at the top ("Search by Patient's Name, Phone number or Id"), type exactly 9821885020 and wait for the patient row to appear
4. In the walk-in search results, find the row for Abhyuday Sultania Updated ws with phone 9821885020
5. On that patient row, open the chevron menu beside SmartRx and click Consult (standard consult, not SmartRx)
6. Wait until the prescription pad loads with the blue Complete button visible in the top header
7. On the prescription pad, scroll inside the main prescription content area (mouse wheel or scrollbar on the prescription body — not the browser chrome) until the Medications (Rx) section heading and the "Search Medicines by Name" field are fully visible. If Past Visit Data or other sections block the view, collapse or scroll past them first. Keep scrolling until both targets are on screen.
8. Wait until the Medications (Rx) section and "Search Medicines by Name" input are clearly visible in the viewport (scroll again if they are still below the fold)
9. In "Search Medicines by Name", type Para, wait for the autocomplete dropdown, then click the first catalog medicine option (not "Add custom medicine"). Stop after the medicine row appears — do not use the header buttons yet.
10. Wait until a medicine row with Para or Paracetamol is visible in the Medications (Rx) list (not only in the search box)
11. Click the blue Complete button at the top-right of the header bar (labeled Complete, with an exit icon). After clicking once, stop immediately — do not click Go to Appointment, back arrow, or any other button.
12. Wait until the prescription print preview page loads with Preview and Print Prescription visible. Do not click Go to Appointment.

## Verify

- url includes: /prescription_print_view
