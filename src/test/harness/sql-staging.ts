// Local staging database for verifying the Supabase migrations.
//
// PGlite is a real PostgreSQL (18.x) compiled to WebAssembly and running inside
// this process, so the migrations are executed by Postgres itself: parser,
// planner, catalog, constraints, RLS and plpgsql all included. What it does not
// have are the Supabase-provided building blocks (the pg_cron / pg_net
// extensions, the Vault schema, the auth schema, and the anon/authenticated
// roles). Those are created here as faithful stubs so the migrations can run
// unmodified apart from the `create extension` lines that would try to load
// extensions PGlite does not ship.
//
// Every substitution is recorded and asserted in the test suite, so the gap
// between "applied here" and "applied on Supabase" stays explicit rather than
// assumed.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

export const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");

/** Supabase building blocks, recreated for Postgres-in-WASM. */
export const SUPABASE_PRELUDE = `
-- Roles that Supabase creates for every project; the migrations grant/revoke to
-- them, so they have to exist for the privilege assertions to mean anything.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then create role supabase_admin nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'postgres') then create role postgres login superuser; end if;
end $$;

-- Supabase's default privileges, copied from its own init script
-- (supabase/postgres migrations/db/init-scripts/00000000000000-initial-schema.sql
-- lines 39-42). This is what makes the harness honest: on a real project every
-- new table and function in public is granted to anon/authenticated/
-- service_role AT CREATION TIME, so revoke ... from public alone leaves those
-- per-role grants in place. Without this block the suite cannot see that
-- (audit finding F2).
grant usage on schema public to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;

create schema if not exists auth;
create schema if not exists vault;
create schema if not exists cron;
create schema if not exists net;
create schema if not exists extensions;

-- auth helpers referenced by RLS policies.
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(current_setting('request.jwt.claim.role', true), 'anon')
$$;

-- Vault: the real thing encrypts at rest; the shape (including the
-- decrypted_secrets view the trigger reads) is what the migrations depend on.
create table if not exists vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  description text,
  secret text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create or replace view vault.decrypted_secrets as
  select id, name, description, secret as decrypted_secret, created_at, updated_at
    from vault.secrets;
create or replace function vault.create_secret(
  new_secret text,
  new_name text,
  new_description text default null
) returns uuid language plpgsql as $$
declare created_id uuid;
begin
  insert into vault.secrets (secret, name, description)
  values (new_secret, new_name, new_description)
  on conflict (name) do update set secret = excluded.secret, updated_at = now()
  returning id into created_id;
  return created_id;
end $$;
create or replace function vault.update_secret(
  secret_id uuid,
  new_secret text default null,
  new_name text default null,
  new_description text default null
) returns void language plpgsql as $$
begin
  update vault.secrets
     set secret = coalesce(new_secret, secret),
         name = coalesce(new_name, name),
         description = coalesce(new_description, description),
         updated_at = now()
   where id = secret_id;
end $$;

-- pg_cron: cron.job plus the two overloads of cron.schedule() and unschedule().
-- Behaviour mirrored from pg_cron: a named schedule upserts, an unknown name
-- raises, and the schedule is stored as text.
-- Shape mirrors citusdata/pg_cron pg_cron.sql + pg_cron--1.2--1.3.sql: the
-- job name is unique per (jobname, username) via the constraint named
-- jobname_username_uniq, which is what cron.schedule_in_database() upserts on.
create table if not exists cron.job (
  jobid bigint generated by default as identity primary key,
  schedule text not null,
  command text not null,
  nodename text not null default 'localhost',
  nodeport integer not null default 5432,
  database text not null default 'postgres',
  username text not null default 'postgres',
  active boolean not null default true,
  jobname text,
  constraint jobname_username_uniq unique (jobname, username)
);
-- Supabase revokes write access to cron.job from postgres and leaves SELECT
-- (supabase/postgres 20231020085357_revoke_writes_on_cron_job_from_postgres.sql,
-- re-applied by extensions.grant_pg_cron_access() on CREATE EXTENSION). Without
-- this line the harness would happily accept a direct update cron.job, which
-- is exactly the bug that would abort db push (audit finding F1).
revoke all on table cron.job from postgres;
grant select on table cron.job to postgres with grant option;

create table if not exists cron.job_run_details (
  jobid bigint,
  runid bigint generated by default as identity primary key,
  status text,
  return_message text,
  start_time timestamptz default now(),
  end_time timestamptz
);

-- pg_net: http_post() with the exact parameter names the trigger uses
-- (url, headers, body, timeout_milliseconds) plus a capture table so tests can
-- assert on what would have been sent -- without a network.
create table if not exists net.captured_requests (
  id bigint generated by default as identity primary key,
  url text not null,
  headers jsonb not null default '{}'::jsonb,
  body jsonb not null default '{}'::jsonb,
  timeout_ms integer,
  captured_at timestamptz not null default now()
);
create table if not exists net._http_response (
  id bigint primary key,
  status_code integer,
  content text,
  headers jsonb,
  timed_out boolean default false,
  error_msg text,
  created timestamptz not null default now()
);

create or replace function net.http_post(
  url text,
  body jsonb default '{}'::jsonb,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb,
  timeout_milliseconds integer default 5000
) returns bigint language plpgsql as $$
#variable_conflict use_column
declare new_id bigint;
begin
  insert into net.captured_requests (url, headers, body, timeout_ms)
  values (url, headers, body, timeout_milliseconds)
  returning id into new_id;

  insert into net._http_response (id, status_code, content)
  values (new_id, 202, 'staged: not sent');
  return new_id;
end $$;

create or replace function net.http_get(
  url text,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb,
  timeout_milliseconds integer default 5000
) returns bigint language plpgsql as $$
begin
  return net.http_post(url := url, headers := headers, timeout_milliseconds := timeout_milliseconds);
end $$;

-- cron.alter_job — parameter names and types copied verbatim from
-- citusdata/pg_cron pg_cron--1.3--1.4.sql (identical in every tag from v1.4.0
-- to v1.6.4). Named-argument calls only work if these names match exactly,
-- which is why they are reproduced literally rather than invented:
--   cron.alter_job(job_id bigint, schedule text default null, command text
--   default null, database text default null, username text default null,
--   active boolean default null) returns void
-- The real function is REVOKEd from public ("admin should decide whether
-- alter_job is safe by explicitly granting execute"); the stub mirrors that.
-- Two properties of the real function matter and are reproduced here:
--   1. it runs the UPDATE as the extension owner (src/job_metadata.c
--      AlterJob(): SetUserIdAndSecContext(CronExtensionOwner(), …)), so the
--      caller needs EXECUTE and nothing else — no UPDATE on cron.job;
--   2. for a non-superuser it only touches rows it owns
--      (and username = currentuser), i.e. the job's creating role.
-- pg_cron also REVOKEs it from public; Supabase grants all functions in schema
-- cron to postgres, which is mirrored below.
create or replace function cron.alter_job(
  job_id bigint,
  schedule text default null,
  command text default null,
  database text default null,
  username text default null,
  active boolean default null
) returns void language plpgsql security definer as $$
begin
  if alter_job.schedule is null and alter_job.command is null
     and alter_job.database is null and alter_job.username is null
     and alter_job.active is null then
    raise exception 'no updates specified';
  end if;

  update cron.job
     set schedule = coalesce(alter_job.schedule, cron.job.schedule),
         command  = coalesce(alter_job.command, cron.job.command),
         database = coalesce(alter_job.database, cron.job.database),
         username = coalesce(alter_job.username, cron.job.username),
         active   = coalesce(alter_job.active, cron.job.active)
   where jobid = alter_job.job_id
     and (session_user = cron.job.username
          or (select rolsuper from pg_roles where rolname = session_user));

  if not found then
    raise exception 'Job % does not exist or you don''t own it', alter_job.job_id;
  end if;
end $$;

revoke all on function cron.alter_job(bigint, text, text, text, text, boolean) from public;
grant execute on function cron.alter_job(bigint, text, text, text, text, boolean) to postgres;

-- cron.schedule_in_database — the API the Phase 6 gate set uses, so a job can
-- be created INACTIVE (cron.schedule() always inserts active). Signature copied
-- verbatim from citusdata/pg_cron pg_cron--1.3--1.4.sql (identical through
-- v1.6.4), including the REVOKE:
--   cron.schedule_in_database(job_name text, schedule text, command text,
--   database text, username text default null, active boolean default 'true')
-- Behaviour mirrored from pg_cron 1.6.4 src/job_metadata.c (ScheduleCronJob):
--   insert ... on conflict on constraint jobname_username_uniq
--   do update set schedule = EXCLUDED.schedule, command = EXCLUDED.command,
--                 database = EXCLUDED.database
-- i.e. a re-schedule of an existing job name updates the schedule/command/
-- database only and leaves "active" untouched. That asymmetry is why the
-- migration also carries the explicit gate statement.
create or replace function cron.schedule_in_database(
  job_name text,
  schedule text,
  command text,
  database text,
  username text default null,
  active boolean default true
) returns bigint language plpgsql as $$
declare new_id bigint;
begin
  -- Every parameter is qualified with the function name: inside an INSERT the
  -- target table's columns are in scope, so an unqualified "schedule" or
  -- "username" would be ambiguous.
  insert into cron.job (jobname, schedule, command, database, username, active)
  values (
    schedule_in_database.job_name,
    schedule_in_database.schedule,
    schedule_in_database.command,
    schedule_in_database.database,
    coalesce(schedule_in_database.username, current_user),
    schedule_in_database.active
  )
  -- The constraint name, exactly as pg_cron's generated INSERT uses it: naming
  -- the columns here would collide with the "username" parameter in plpgsql.
  on conflict on constraint jobname_username_uniq do update
     set schedule = excluded.schedule,
         command  = excluded.command,
         database = excluded.database
  returning jobid into new_id;
  return new_id;
end $$;

revoke all on function cron.schedule_in_database(text, text, text, text, text, boolean) from public;

create or replace function cron.schedule(p_job_name text, p_schedule text, p_command text)
returns bigint language plpgsql as $$
declare existing_id bigint; result_id bigint;
begin
  select j.jobid into existing_id from cron.job j where j.jobname = p_job_name;
  if existing_id is null then
    insert into cron.job (jobname, schedule, command)
    values (p_job_name, p_schedule, p_command) returning jobid into result_id;
  else
    update cron.job j set schedule = p_schedule, command = p_command
      where j.jobid = existing_id returning j.jobid into result_id;
  end if;
  return result_id;
end $$;

-- cron.schedule(schedule, command): pg_cron leaves jobname NULL for this form
-- (the unnamed job is only addressable by jobid).
create or replace function cron.schedule(p_schedule text, p_command text)
returns bigint language plpgsql as $$
declare result_id bigint;
begin
  insert into cron.job (jobname, schedule, command)
  values (null, p_schedule, p_command) returning jobid into result_id;
  return result_id;
end $$;

create or replace function cron.unschedule(p_job_name text)
returns boolean language plpgsql as $$
declare removed integer;
begin
  delete from cron.job where jobname = p_job_name;
  get diagnostics removed = row_count;
  if removed = 0 then
    raise exception 'could not find valid entry for job %', p_job_name;
  end if;
  return true;
end $$;

create or replace function cron.unschedule(p_jobid bigint)
returns boolean language plpgsql as $$
begin
  return cron.unschedule((select jobname from cron.job where jobid = p_jobid));
end $$;
`;

export interface MigrationRun {
  file: string;
  ok: boolean;
  error?: string;
  /** `create extension` statements PGlite cannot load. */
  substituted: string[];
  durationMs: number;
}

export interface StagingDb {
  db: PGlite;
  runs: MigrationRun[];
  allSubstituted: string[];
  close: () => Promise<void>;
}

/**
 * PGlite has no pg_cron / pg_net / pgcrypto. pgcrypto is only needed for
 * `gen_random_uuid()`, which is built into Postgres 13+ and therefore already
 * available; the cron and net extensions are replaced by the stubs in
 * SUPABASE_PRELUDE.
 */
const UNAVAILABLE_EXTENSIONS = [/create extension if not exists pg_cron;/i, /create extension if not exists pg_net;/i, /create extension if not exists pgcrypto;/i];

export function prepareMigrationSql(sql: string): { sql: string; substituted: string[] } {
  const substituted: string[] = [];
  let out = sql;
  for (const pattern of UNAVAILABLE_EXTENSIONS) {
    if (pattern.test(out)) {
      substituted.push(String(pattern));
      out = out.replace(pattern, "-- [staging] extension provided by the Supabase platform (stubbed in the prelude)");
    }
  }
  return { sql: out, substituted };
}

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

export function readMigration(file: string): string {
  return readFileSync(join(MIGRATIONS_DIR, file), "utf8");
}

/** Boot a database and apply every migration in filename order. */
export async function createStagingDb(options: { files?: string[] } = {}): Promise<StagingDb> {
  const db = await PGlite.create();
  await db.exec(SUPABASE_PRELUDE);
  // Creating the publication here mirrors a Supabase project, where it exists
  // before any migration runs (realtime is enabled by default).
  // `create publication if not exists` is not valid Postgres syntax, hence the DO block.
  await db.exec(`do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;`);

  const runs: MigrationRun[] = [];
  const allSubstituted: string[] = [];

  for (const file of options.files ?? migrationFiles()) {
    const prepared = prepareMigrationSql(readMigration(file));
    allSubstituted.push(...prepared.substituted);
    const startedAt = Date.now();
    try {
      await db.exec(prepared.sql);
      runs.push({ file, ok: true, substituted: prepared.substituted, durationMs: Date.now() - startedAt });
    } catch (error) {
      // Surface the offending file immediately: the run list is asserted on,
      // but a silent failure inside beforeAll is hard to read otherwise.
      console.error(`[staging] ${file} failed:`, error);
      runs.push({
        file,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        substituted: prepared.substituted,
        durationMs: Date.now() - startedAt,
      });
    }
  }

  return { db, runs, allSubstituted, close: () => db.close() };
}

/** Single-row helper that keeps the tests readable. */
export async function scalar<T = unknown>(db: PGlite, sql: string, params?: unknown[]): Promise<T> {
  const result = await db.query<Record<string, T>>(sql, params as never[]);
  const row = result.rows[0];
  return row ? (Object.values(row)[0] as T) : (undefined as unknown as T);
}

export async function rows<T = Record<string, unknown>>(db: PGlite, sql: string, params?: unknown[]): Promise<T[]> {
  const result = await db.query<T>(sql, params as never[]);
  return result.rows;
}
