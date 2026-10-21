import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { inject } from 'vitest';

export type Client = pg.PoolClient;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) pool = new pg.Pool({ connectionString: inject('dbUrl'), max: 4 });
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = null;
}

/** Requête en superutilisateur (contourne la RLS) : préparation des données uniquement. */
export async function admin<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(sql, params);
}

export type AccountType = 'eleve' | 'parent' | 'enseignant' | 'responsable_pedagogique' | 'administrateur' | null;

/** Simule une inscription Supabase Auth (insertion dans auth.users → déclencheur). */
export async function signUp(displayName: string, accountType: AccountType): Promise<string> {
  const id = randomUUID();
  const meta: Record<string, string> = { display_name: displayName };
  if (accountType) meta.account_type = accountType;
  await admin('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
    id,
    `${id}@test.ci`,
    JSON.stringify(meta),
  ]);
  return id;
}

/** Amorçage d'un administrateur, comme documenté (opération en ligne de commande). */
export async function bootstrapRole(userId: string, role: string): Promise<void> {
  await admin('insert into public.user_roles (user_id, role) values ($1, $2) on conflict do nothing', [
    userId,
    role,
  ]);
  if (role === 'enseignant') {
    await admin('insert into public.teachers (user_id) values ($1) on conflict do nothing', [userId]);
  }
}

async function inTransaction<T>(
  role: 'authenticated' | 'anon',
  sub: string | null,
  fn: (c: Client) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${role}`);
    const claims = sub ? { sub, role } : { role };
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

/** Exécute fn comme le ferait PostgREST pour un utilisateur connecté (RLS active). */
export const asUser = <T>(userId: string, fn: (c: Client) => Promise<T>) =>
  inTransaction('authenticated', userId, fn);

/** Exécute fn comme un visiteur non connecté (clé anon). */
export const asAnon = <T>(fn: (c: Client) => Promise<T>) => inTransaction('anon', null, fn);
