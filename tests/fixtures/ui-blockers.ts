/**
 * Central registry of known UI blockers on rx-pad UAT.
 * Add new entries here — dismissKnownBlockers() picks them up automatically.
 */
export type UiBlockerCategory = 'third-party' | 'product' | 'transient';

export type UiBlockerDefinition = {
  id: string;
  name: string;
  category: UiBlockerCategory;
  /** Human-readable note for blocker-log.json */
  description: string;
};

export const UI_BLOCKER_REGISTRY: UiBlockerDefinition[] = [
  {
    id: 'moengage-premium',
    name: 'MoEngage premium banner',
    category: 'third-party',
    description: 'Onsite campaign overlay — hidden via init script + route abort',
  },
  {
    id: 'talkative-chat',
    name: 'Talkative chat widget',
    category: 'third-party',
    description: '#talkative-engage intercepts bottom-right clicks',
  },
  {
    id: 'document-verification',
    name: 'Document verification popup',
    category: 'product',
    description: 'Upload proof banner — dismiss via Do later',
  },
  {
    id: 'appointment-disclaimer',
    name: 'Appointment disclaimer',
    category: 'product',
    description: 'CVT / disclaimer close icon on dashboard',
  },
  {
    id: 'past-time-slot',
    name: 'Past time slot popover',
    category: 'transient',
    description: 'Appointment booking warning — Escape to close',
  },
  {
    id: 'tour-okay',
    name: 'Tour / onboarding Okay',
    category: 'transient',
    description: 'PillUp and generic Okay buttons',
  },
  {
    id: 'ant-tour',
    name: 'Ant Design tour',
    category: 'transient',
    description: 'Ant tour / popover close controls',
  },
  {
    id: 'generic-dismiss',
    name: 'Generic dismiss CTA',
    category: 'transient',
    description: 'Not now / maybe later / skip / close buttons',
  },
  {
    id: 'dose-calculator',
    name: 'Dose calculator modal',
    category: 'product',
    description: 'Blocks End Visit when left open on Rx pad',
  },
  {
    id: 'previously-prescribed-alert',
    name: 'Previously prescribed alert',
    category: 'product',
    description: 'Alert when re-prescribing medicine from last Rx',
  },
  {
    id: 'webpack-dev-overlay',
    name: 'Webpack dev server error overlay',
    category: 'transient',
    description: 'localhost compile overlay (#webpack-dev-server-client-overlay) intercepts clicks',
  },
];

export const UI_BLOCKER_DOM_REMOVE_SELECTORS = [
  '#talkative-engage',
  '[id*="talkative"]',
  'iframe[title*="chat" i]',
  '#webpack-dev-server-client-overlay',
] as const;
