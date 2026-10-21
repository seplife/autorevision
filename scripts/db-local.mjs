#!/usr/bin/env node
/**
 * PostgreSQL 16 jetable pour le développement et les tests, sans Docker.
 *
 *   node scripts/db-local.mjs start   démarre (et initialise si besoin) puis applique les migrations
 *   node scripts/db-local.mjs stop    arrête le serveur
 *   node scripts/db-local.mjs reset   supprime les données et recommence
 *   node scripts/db-local.mjs fresh <nom_base>   (re)crée une base vierge avec shim + migrations
 *
 * Préférez la CLI Supabase (`supabase start`) quand Docker est disponible : elle fournit
 * le vrai Supabase Auth. Ce script n'émule que le strict nécessaire aux tests RLS.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, chownSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { userInfo } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseDir = join(root, '.local');
const dataDir = join(baseDir, 'pgdata');
const socketDir = baseDir;
export const PORT = Number(process.env.RSCI_PG_PORT ?? 54329);
const DEFAULT_DB = 'rsci';

function findBinDir() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  try {
    const dir = execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim();
    if (existsSync(join(dir, 'pg_ctl'))) return dir;
  } catch {
    /* pg_config absent : on cherche dans les emplacements Debian/Ubuntu */
  }
  const base = '/usr/lib/postgresql';
  if (existsSync(base)) {
    const versions = readdirSync(base).sort((a, b) => Number(b) - Number(a));
    for (const v of versions) {
      const dir = join(base, v, 'bin');
      if (existsSync(join(dir, 'pg_ctl'))) return dir;
    }
  }
  throw new Error('Binaires PostgreSQL introuvables. Définissez PG_BIN.');
}

const bin = findBinDir();
const isRoot = userInfo().uid === 0;
// PostgreSQL refuse de tourner en root : on délègue à un utilisateur non privilégié.
const runAs = process.env.RSCI_PG_USER ?? (isRoot ? 'claude' : null);

function pg(tool, args, opts = {}) {
  const cmd = join(bin, tool);
  const full = runAs ? ['runuser', ['-u', runAs, '--', cmd, ...args]] : [cmd, args];
  const res = spawnSync(full[0], full[1], { encoding: 'utf8', ...opts });
  if (res.status !== 0 && !opts.allowFail) {
    throw new Error(`${tool} a échoué :\n${res.stdout}\n${res.stderr}`);
  }
  return res;
}

function ownForRunner(path) {
  if (!runAs) return;
  const uid = Number(execFileSync('id', ['-u', runAs], { encoding: 'utf8' }).trim());
  const gid = Number(execFileSync('id', ['-g', runAs], { encoding: 'utf8' }).trim());
  chownSync(path, uid, gid);
}

function psql(db, sqlOrFile, { file = false } = {}) {
  const args = ['-h', '127.0.0.1', '-p', String(PORT), '-U', 'postgres', '-d', db,
    '-v', 'ON_ERROR_STOP=1', '-q', '-X', '-t', '-A'];
  args.push(file ? '-f' : '-c', sqlOrFile);
  const res = spawnSync('psql', args, { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`psql (${db}) a échoué :\n${res.stderr}`);
  return res.stdout;
}

function isRunning() {
  if (!existsSync(join(dataDir, 'PG_VERSION'))) return false;
  return pg('pg_ctl', ['-D', dataDir, 'status'], { allowFail: true }).status === 0;
}

export function start() {
  if (!existsSync(baseDir)) mkdirSync(baseDir, { recursive: true });
  ownForRunner(baseDir);
  if (!existsSync(join(dataDir, 'PG_VERSION'))) {
    pg('initdb', ['-D', dataDir, '-U', 'postgres', '--auth=trust', '--encoding=UTF8',
      '--locale=C.UTF-8']);
  }
  if (!isRunning()) {
    pg('pg_ctl', ['-D', dataDir, '-l', join(baseDir, 'postgres.log'), '-w', 'start', '-o',
      `-p ${PORT} -k ${socketDir} -c listen_addresses=127.0.0.1 -c timezone=Africa/Abidjan`]);
  }
  return `postgres://postgres@127.0.0.1:${PORT}`;
}

export function stop() {
  if (isRunning()) pg('pg_ctl', ['-D', dataDir, '-w', 'stop', '-m', 'fast']);
}

export function migrationFiles() {
  const dir = join(root, 'supabase', 'migrations');
  return readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => join(dir, f));
}

/** (Re)crée une base vierge : shim Supabase + toutes les migrations dans l'ordre. */
export function fresh(db) {
  if (!/^[a-z_][a-z0-9_]*$/.test(db)) throw new Error(`Nom de base invalide : ${db}`);
  psql('postgres', `drop database if exists ${db} with (force)`);
  psql('postgres', `create database ${db}`);
  psql(db, join(root, 'supabase', 'tests', 'shim', '00_supabase_auth_shim.sql'), { file: true });
  for (const f of migrationFiles()) psql(db, f, { file: true });
  return `postgres://postgres@127.0.0.1:${PORT}/${db}`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd = 'start', arg] = process.argv.slice(2);
  try {
    if (cmd === 'start') {
      start();
      const exists = psql('postgres', `select 1 from pg_database where datname='${DEFAULT_DB}'`).trim();
      const url = exists ? `postgres://postgres@127.0.0.1:${PORT}/${DEFAULT_DB}` : fresh(DEFAULT_DB);
      console.log(`PostgreSQL local prêt : ${url}`);
    } else if (cmd === 'stop') {
      stop();
      console.log('PostgreSQL local arrêté.');
    } else if (cmd === 'reset') {
      stop();
      rmSync(dataDir, { recursive: true, force: true });
      start();
      console.log(`Base réinitialisée : ${fresh(DEFAULT_DB)}`);
    } else if (cmd === 'fresh') {
      start();
      console.log(fresh(arg ?? DEFAULT_DB));
    } else {
      console.error(`Commande inconnue : ${cmd}`);
      process.exit(2);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

// Utilisé par les tests pour lire un fichier SQL si nécessaire.
export const readSql = (p) => readFileSync(p, 'utf8');
