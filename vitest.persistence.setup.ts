// Loads .env into process.env so the supabase-test-client — which reads
// VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from process.env — can
// construct against dev-db during Layer 5 persistence specs.
//
// In CI the .env file is absent (secrets are injected as env vars), so we
// only load when the file is present and otherwise rely on process.env.
import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}
