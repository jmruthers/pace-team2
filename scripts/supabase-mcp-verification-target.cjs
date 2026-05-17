#!/usr/bin/env node
/**
 * Point Cursor Supabase MCP at the backend-ready verified-contract project.
 * Pace-core `npm run env:dev` overwrites [.cursor/mcp.json] with consumer dev —
 * run this before MCP §12 / §15 `execute_sql` checks.
 *
 * Canonical ref: TEAM backend-ready report (`docs/delivery/team-build-queue.md`).
 */
const fs = require('node:fs');
const path = require('node:path');

const MCP_VERIFICATION_PROJECT_REF = 'yihzsfcceciimdoiibif';

const rootDir = process.cwd();
const mcpPath = path.join(rootDir, '.cursor', 'mcp.json');
const config = {
  mcpServers: {
    supabase: {
      url: `https://mcp.supabase.com/mcp?project_ref=${MCP_VERIFICATION_PROJECT_REF}`,
    },
  },
};

fs.mkdirSync(path.dirname(mcpPath), { recursive: true });
fs.writeFileSync(mcpPath, `${JSON.stringify(config, null, 2)}\n`);
// eslint-disable-next-line no-console
console.log(`MCP Supabase → verification project ${MCP_VERIFICATION_PROJECT_REF}`);
// eslint-disable-next-line no-console
console.log(`Wrote ${mcpPath}`);
// eslint-disable-next-line no-console
console.log('Reminder: Restart Cursor MCP or reconnect if the IDE cached the prior project ref.');
// eslint-disable-next-line no-console
console.log('Note: npm run env:dev rewires MCP to SUPABASE_PROJECT_REF — run npm run mcp:verification afterward for DB audits.');
