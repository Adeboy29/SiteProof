create table public.platform_admins(user_id uuid primary key references auth.users,created_at timestamptz not null default now());
alter table public.platform_admins enable row level security;
create policy admin_self on public.platform_admins for select to authenticated using(user_id=auth.uid());
create function public.is_platform_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from platform_admins where user_id=auth.uid()) $$;
revoke all on function public.is_platform_admin() from public;grant execute on function public.is_platform_admin() to authenticated;
-- Bootstrap administrators only through trusted SQL, never a client-supplied role.
create function public.create_profile() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name','')) on conflict do nothing;return new;end $$;
create trigger on_user_created after insert on auth.users for each row execute function public.create_profile();
insert into public.profiles(id,display_name) select id,coalesce(raw_user_meta_data->>'display_name','') from auth.users on conflict do nothing;
