#!/usr/bin/env bun
/**
 * `install-packages` — request apt and/or npm packages added to YOUR
 * per-agent container image. Requires admin approval; fire-and-forget.
 *
 *   install-packages --apt '["jq","ripgrep"]' [--npm '["pkg-name"]'] \
 *                    [--reason "why these are needed"]
 *
 * On approval, the image is rebuilt and the container is restarted.
 *
 * Replaces mcp__nanoclaw__install_packages.
 */
import { writeMessageOut } from '../db/messages-out.js';
import { initTool, ok, run } from './_shared/output.js';
import { parseArgs, readFlagString, readFlagStringArray, validateArgs } from './_shared/args.js';
import { generateId } from './_shared/ids.js';

initTool(import.meta.url);

const HELP = `install-packages: Request apt and/or npm packages for your container image.

Usage:
  install-packages [--apt JSON] [--npm JSON] [--reason TEXT]

Flags:
  --apt JSON      apt package names (JSON array, names only — no version specs).
  --npm JSON      npm package names (JSON array, names only — no version specs).
  --reason TEXT   Why these packages are needed.

At least one of --apt or --npm is required. Requires admin approval; the
container will be restarted automatically on approval.
`;

const APT_RE = /^[a-z0-9][a-z0-9._+-]*$/;
const NPM_RE = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const MAX_PACKAGES = 20;

run(() => {
  const argv = process.argv.slice(2);
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  const args = parseArgs(argv);
  validateArgs(args, ['apt', 'npm', 'reason']);
  const apt = readFlagStringArray(args, 'apt') ?? [];
  const npm = readFlagStringArray(args, 'npm') ?? [];
  const reason = readFlagString(args, 'reason') ?? '';

  if (apt.length === 0 && npm.length === 0) {
    throw new Error('At least one apt or npm package is required');
  }
  if (apt.length + npm.length > MAX_PACKAGES) {
    throw new Error(`Maximum ${MAX_PACKAGES} packages per request`);
  }

  const invalidApt = apt.find((p) => !APT_RE.test(p));
  if (invalidApt) {
    throw new Error(`Invalid apt package name: "${invalidApt}". Only lowercase letters, digits, and ._+- allowed.`);
  }
  const invalidNpm = npm.find((p) => !NPM_RE.test(p));
  if (invalidNpm) {
    throw new Error(`Invalid npm package name: "${invalidNpm}". No version specs or shell characters.`);
  }

  const requestId = generateId();
  writeMessageOut({
    id: requestId,
    kind: 'system',
    content: JSON.stringify({
      action: 'install_packages',
      apt,
      npm,
      reason,
    }),
  });

  ok('Package install request submitted. You will be notified when admin approves or rejects.');
});
