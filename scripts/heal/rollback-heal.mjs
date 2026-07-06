import fs from 'node:fs';
import path from 'node:path';
import { PATHS, ensureDir, readJson, writeJson, timestampSlug, log } from './lib.mjs';
import { restoreBackup } from './lib.mjs';

const BACKUP_DIR = path.join(PATHS.latestDir, 'backup');

/**
 * Roll back files touched by the heal patch from pre-apply snapshot.
 */
export function rollbackHeal({ reason, session }) {
  const restored = restoreBackup(BACKUP_DIR);
  const slug = timestampSlug();
  const rollbackMd = path.join(PATHS.sessionsDir, `rollback-${slug}.md`);

  const body = `# Heal rollback — ${slug}

## Reason

${reason}

## Session

- ID: \`${session?.session_id ?? 'unknown'}\`
- Spec: \`${session?.failed_spec ?? '?'}\`

## Files restored

${restored.length ? restored.map((f) => `- \`${f}\``).join('\n') : '_No files in backup manifest_'}

## Next steps

1. Review why verify/ground-truth failed
2. Fix portal bug or revise proposed.patch in Cursor
3. Re-run \`npm run test:heal:apply\` when ready
`;

  ensureDir(PATHS.sessionsDir);
  fs.writeFileSync(rollbackMd, body, 'utf-8');
  log(`rollback doc → ${rollbackMd}`);

  writeJson(path.join(PATHS.latestDir, 'rollback.json'), {
    rolledBackAt: new Date().toISOString(),
    reason,
    restored,
    rollbackDoc: rollbackMd,
  });

  return { restored, rollbackMd };
}

/** Manual rollback entry point */
export function runRollbackCli() {
  const session = readJson(path.join(PATHS.latestDir, 'heal-session.json'));
  rollbackHeal({ reason: 'Manual rollback via test:heal:rollback', session });
}
