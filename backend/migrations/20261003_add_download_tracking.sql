-- Track every user download and keep the existing history audit table useful.
-- Run this once in Supabase SQL Editor.

alter table public.downloads
  add column if not exists user_id uuid;

alter table public.downloads
  add column if not exists file_id uuid;

alter table public.downloads
  add column if not exists file_name text;

alter table public.downloads
  add column if not exists storage_path text;

alter table public.downloads
  add column if not exists mime_type text;

alter table public.downloads
  add column if not exists downloaded_at timestamptz default now();

create index if not exists downloads_user_id_idx
  on public.downloads(user_id);

create index if not exists downloads_downloaded_at_idx
  on public.downloads(downloaded_at desc);
