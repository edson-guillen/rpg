// Lê as chaves do Supabase local em execução, para não mantê-las no repositório.
import { execSync } from 'node:child_process';

export function chavesLocais() {
  const s = JSON.parse(execSync('npx -y supabase@latest status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  return { ANON: s.ANON_KEY, SERVICE: s.SERVICE_ROLE_KEY };
}
