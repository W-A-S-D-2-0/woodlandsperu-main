import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Base de datos de pruebas: PostgreSQL en WASM (PGlite) con un shim mínimo de Supabase
 * y todas las migraciones de supabase/migrations aplicadas en orden.
 * No se conecta a ninguna base externa.
 */

const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', 'migrations')

// Reproduce lo que Supabase provee antes de nuestras migraciones: roles de la API,
// esquema auth con auth.jwt()/auth.uid() y los privilegios por defecto amplios que
// Supabase concede sobre `public` (así se prueba que nuestras revocaciones funcionan).
const SUPABASE_SHIM = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key, email text);

  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select auth.jwt() ->> 'role'
  $$;
  grant execute on all functions in schema auth to anon, authenticated, service_role;

  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`

export function listMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()
}

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(SUPABASE_SHIM)
  for (const file of listMigrations()) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
    } catch (error) {
      throw new Error(`Falló la migración ${file}: ${(error as Error).message}`, { cause: error })
    }
  }
  return db
}

export type Actor =
  | { kind: 'anon' }
  | { kind: 'service' }
  | { kind: 'user'; userId: string }

export const anon: Actor = { kind: 'anon' }
export const service: Actor = { kind: 'service' }
export const user = (userId: string): Actor => ({ kind: 'user', userId })

/**
 * Ejecuta `fn` como lo haría la API de Supabase para ese actor: claims del JWT y rol
 * de base de datos locales a una transacción. Por defecto se revierte todo al final.
 */
export async function as<T>(db: PGlite, actor: Actor, fn: () => Promise<T>, options: { commit?: boolean } = {}): Promise<T> {
  const role = actor.kind === 'user' ? 'authenticated' : actor.kind === 'service' ? 'service_role' : 'anon'
  const claims =
    actor.kind === 'user' ? { sub: actor.userId, role: 'authenticated' } : { role: role }

  await db.exec('begin')
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)])
    await db.exec(`set local role ${role}`)
    const result = await fn()
    await db.exec(options.commit ? 'commit' : 'rollback')
    return result
  } catch (error) {
    await db.exec('rollback')
    throw error
  }
}

/** Ejecuta `fn` con privilegios de propietario (como una migración o el editor SQL) y revierte. */
export async function asOwner<T>(db: PGlite, fn: () => Promise<T>): Promise<T> {
  await db.exec('begin')
  try {
    const result = await fn()
    await db.exec('rollback')
    return result
  } catch (error) {
    await db.exec('rollback')
    throw error
  }
}
