-- Add a type so History can distinguish Text, Audio and PDF translations.
-- Run this once in Supabase SQL Editor.

alter table public.translation_history
add column if not exists content_type text;

update public.translation_history
set content_type = coalesce(content_type, 'text')
where content_type is null;

alter table public.translation_history
alter column content_type set default 'text';

alter table public.translation_history
add constraint translation_history_content_type_check
check (content_type in ('text', 'audio', 'pdf'))
not valid;

alter table public.translation_history
validate constraint translation_history_content_type_check;

alter table public.translation_history
alter column content_type set not null;
