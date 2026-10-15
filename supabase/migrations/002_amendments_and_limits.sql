create table public.criteria_amendments(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects,milestone_id uuid not null,base_version integer not null,criteria jsonb not null check(jsonb_typeof(criteria)='array' and jsonb_array_length(criteria)>0),reason text not null,proposed_by uuid not null references auth.users,status text not null default 'pending' check(status in ('pending','agreed')),created_at timestamptz not null default now(),foreign key(milestone_id,project_id) references public.milestones(id,project_id));
create unique index one_pending_amendment on public.criteria_amendments(milestone_id) where status='pending';
create table public.amendment_consents(amendment_id uuid not null references public.criteria_amendments,user_id uuid not null references auth.users,created_at timestamptz not null default now(),primary key(amendment_id,user_id));
alter table criteria_amendments enable row level security;
alter table amendment_consents enable row level security;
create policy amendment_read on criteria_amendments for select to authenticated using(project_role(project_id) is not null);
create policy consent_read on amendment_consents for select to authenticated using(exists(select 1 from criteria_amendments a where a.id=amendment_id and project_role(a.project_id) is not null));
create function public.amend_criteria(operation text,payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare m milestones;a criteria_amendments;actor uuid:=auth.uid();rid uuid;begin
 if actor is null then raise exception 'Authentication required';end if;
 if operation='propose' then
  select * into m from milestones where id=(payload->>'milestone_id')::uuid for update;
  if project_role(m.project_id)<>'owner' or project_role(m.project_id) is null then raise exception 'Owner required';end if;
  if length(payload->>'reason')<10 then raise exception 'Explain amendment';end if;
  insert into criteria_amendments(project_id,milestone_id,base_version,criteria,reason,proposed_by) values(m.project_id,m.id,m.version,to_jsonb(regexp_split_to_array(trim(payload->>'criteria'),E'\n+')),payload->>'reason',actor) returning * into a;
 elsif operation='agree' then
  select * into a from criteria_amendments where id=(payload->>'amendment_id')::uuid for update;
  if a.status<>'pending' or a.id is null then raise exception 'Amendment unavailable';end if;
  select * into m from milestones where id=a.milestone_id for update;
  if project_role(m.project_id) not in ('owner','contractor') or project_role(m.project_id) is null then raise exception 'Agreement party required';end if;
  if a.base_version<>m.version then raise exception 'Stale criteria version';end if;
 else raise exception 'Unsupported operation';end if;
 insert into amendment_consents(amendment_id,user_id) values(a.id,actor) on conflict do nothing;
 if not exists(select 1 from project_members pm where pm.project_id=m.project_id and pm.role in ('owner','contractor') and not exists(select 1 from amendment_consents c where c.amendment_id=a.id and c.user_id=pm.user_id)) then
  update criteria_amendments set status='agreed' where id=a.id;
  update milestones set criteria=a.criteria,version=m.version+1,status='draft',updated_at=now() where id=m.id;
  insert into milestone_criteria(project_id,milestone_id,version,criteria,agreed_by) values(m.project_id,m.id,m.version+1,a.criteria,actor);
 end if;
 insert into activity_events(project_id,actor_id,type,summary,record_id) values(m.project_id,actor,'criteria_amendment',operation||' · '||a.reason,a.id);
 return a.id;end $$;
revoke all on function public.amend_criteria(text,jsonb) from public;grant execute on function public.amend_criteria(text,jsonb) to authenticated;
create table public.request_limits(user_id uuid references auth.users,bucket text,window_start timestamptz not null default now(),requests integer not null default 1,primary key(user_id,bucket));
alter table public.request_limits enable row level security;
create function public.consume_limit(bucket_name text,max_requests integer) returns boolean language plpgsql security definer set search_path=public as $$
declare count_now integer;begin
 if auth.uid() is null or bucket_name not in ('write','upload','assessment','status') then return false;end if;
 -- Limits are server-defined inside SQL; callers cannot raise them.
 max_requests:=case bucket_name when 'assessment' then 5 when 'upload' then 20 when 'status' then 60 else 60 end;
 insert into request_limits(user_id,bucket) values(auth.uid(),bucket_name) on conflict(user_id,bucket) do update set requests=case when request_limits.window_start<now()-interval '1 minute' then 1 else request_limits.requests+1 end,window_start=case when request_limits.window_start<now()-interval '1 minute' then now() else request_limits.window_start end returning requests into count_now;
 return count_now<=max_requests;end $$;
revoke all on function public.consume_limit(text,integer) from public;grant execute on function public.consume_limit(text,integer) to authenticated;
