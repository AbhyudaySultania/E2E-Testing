import fs from 'fs';
import path from 'path';

const SCENARIOS_DIR = path.join(__dirname, 'scenarios');

export type ScenarioVerify = {
  urlIncludes?: string;
};

export type AiScenario = {
  id: string;
  title: string;
  steps: string[];
  verify?: ScenarioVerify;
};

function parseScenarioFile(filePath: string): AiScenario {
  const id = path.basename(filePath, '.md');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/);

  let title = id;
  const steps: string[] = [];
  let verify: ScenarioVerify | undefined;
  let section: 'none' | 'steps' | 'verify' = 'none';

  for (const line of lines) {
    if (/^#\s+/.test(line) && !/^##\s+/.test(line)) {
      title = line.replace(/^#\s+/, '').trim();
      continue;
    }
    if (/^##\s+steps\b/i.test(line)) {
      section = 'steps';
      continue;
    }
    if (/^##\s+verify\b/i.test(line)) {
      section = 'verify';
      continue;
    }
    if (/^##\s+/.test(line)) {
      section = 'none';
      continue;
    }

    if (section === 'steps') {
      const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)/);
      if (bullet?.[1]) steps.push(bullet[1].trim());
    }

    if (section === 'verify') {
      const urlMatch = line.match(
        /^\s*[-*]\s*url(?:\s+includes)?:\s*(.+)/i,
      );
      if (urlMatch?.[1]) {
        verify = { ...verify, urlIncludes: urlMatch[1].trim() };
      }
    }
  }

  return { id, title, steps, verify };
}

/** Load `tests/ai/scenarios/*.md`. Filter with `RX_AI_SCENARIO=<filename-without-md>`. */
export function loadScenarios(): AiScenario[] {
  if (!fs.existsSync(SCENARIOS_DIR)) return [];

  const filter = process.env.RX_AI_SCENARIO?.trim();

  return fs
    .readdirSync(SCENARIOS_DIR)
    .filter((name) => name.endsWith('.md'))
    .map((name) => parseScenarioFile(path.join(SCENARIOS_DIR, name)))
    .filter((scenario) => scenario.steps.length > 0)
    .filter((scenario) => !filter || scenario.id === filter);
}
