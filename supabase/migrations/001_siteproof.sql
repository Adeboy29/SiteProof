create extension if not exists pgcrypto;
create table public.profiles(id uuid primary key references auth.users on delete cascade, display_name text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.organizations(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 180),owner_id uuid not null references auth.users,created_at timestamptz not null default now());
create table public.organization_members(organization_id uuid references public.organizations on delete cascade,user_id uuid references auth.users,role text not null check(role in ('owner','member')),created_at timestamptz not null default now(),primary key(organization_id,user_id));
create table public.projects(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,owner_id uuid not null references auth.users,name text not null check(length(name) between 1 and 180),reference text not null,address text not null,description text not null default '',status text not null default 'active' check(status in ('active','on_hold','completed')),currency text not null default 'NGN',start_date date,target_date date,agreement_reference text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,reference));
create table public.project_members(project_id uuid references public.projects on delete cascade,user_id uuid references auth.users,role text not null check(role in ('owner','contractor','inspector','manager')),created_at timestamptz not null default now(),primary key(project_id,user_id));
create table public.milestones(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects,title text not null,description text not null default '',scope text not null default '',deliverables jsonb not null default '[]',required_evidence jsonb not null default '[]',contractor_id uuid references auth.users,inspector_id uuid references auth.users,criteria jsonb not null check(jsonb_typeof(criteria)='array' and jsonb_array_length(criteria)>0),version integer not null default 1,status text not null default 'draft' check(status in ('draft','submitted','accepted','disputed','additional_evidence','assessed','appeal_pending')),due_date date not null,value numeric(18,2) not null check(value>=0),payment_conditions text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,project_id));
create table public.milestone_criteria(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects,milestone_id uuid not null,version integer not null,criteria jsonb not null,agreed_by uuid not null references auth.users,created_at timestamptz not null default now(),foreign key(milestone_id,project_id) references public.milestones(id,project_id),unique(milestone_id,version));
create table public.milestone_submissions(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects,milestone_id uuid not null,criteria_version integer not null,criteria_snapshot jsonb not null,evidence_manifest jsonb not null,actor_id uuid not null references auth.users,created_at timestamptz not null default now(),foreign key(milestone_id,project_id) references public.milestones(id,project_id));
create table public.evidence_files(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects,milestone_id uuid not null,actor_id uuid not null references auth.users,name text not null,description text not null,hash text not null check(hash ~ '^[0-9a-f]{64}$'),path text not null unique,type text not null check(type in ('image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv')),size bigint not null check(size between 1 and 4194304),reviewed boolean not null default false,inspection_notes text,created_at timestamptz not null default now(),foreign key(milestone_id,project_id) references public.milestones(id,project_id));
create table public.inspections(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects,milestone_id uuid not null,actor_id uuid not null references auth.users,notes text not null,measurements jsonb not null default '{}',created_at timestamptz not null default now(),foreign key(milestone_id,project_id) references public.milestones(id,project_id));
create table public.disputes(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects,milestone_id uuid not null,actor_id uuid not null references auth.users,reason text not null,requirements jsonb not null,rules text not null default 'Assess only supplied evidence; escalate uncertainty to human review',status text not null default 'open',created_at timestamptz not null default now(),foreign key(milestone_id,project_id) references public.milestones(id,project_id));
create table public.dispute_participants(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects,dispute_id uuid not null references public.disputes,user_id uuid not null references auth.users,created_at timestamptz not null default now(),unique(dispute_id,user_id));
create table public.assessments(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects,milestone_id uuid not null,submission_id uuid not null references public.milestone_submissions,criteria_version integer not null,mode text not null check(mode in ('development','genlayer')),status text not null default 'requested' check(status in ('requested','submitted','pending','finalized','rejected','inconclusive','human_review','submission_unknown')),report jsonb,manifest_hash text,created_at timestamptz not null default now(),foreign key(milestone_id,project_id) references public.milestones(id,project_id),unique(submission_id,mode));
create table public.genlayer_transactions(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects,assessment_id uuid not null references public.assessments,hash text not null unique,contract_address text not null,network text not null,status text not null,execution_outcome text,metadata jsonb not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.appeals(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects,milestone_id uuid not null,actor_id uuid not null references auth.users,assessment_id uuid references public.assessments,reason text not null,status text not null default 'human_review',created_at timestamptz not null default now(),foreign key(milestone_id,project_id) references public.milestones(id,project_id));
create table public.activity_events(id uuid primary key default gen_random_uuid(),project_id uuid references public.projects,actor_id uuid not null references auth.users,type text not null,summary text not null,record_id uuid,created_at timestamptz not null default now());
create table public.notifications(id uuid primary key default gen_random_uuid(),project_id uuid references public.projects,user_id uuid not null references auth.users,message text not null,read boolean not null default false,created_at timestamptz not null default now());
create function public.project_role(pid uuid) returns text language sql stable security definer set search_path=public as $$ select role from project_members where project_id=pid and user_id=auth.uid() $$;
create function public.org_owner(oid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from organizations where id=oid and owner_id=auth.uid()) $$;
alter table profiles enable row level security;
create policy self_profile on profiles for select to authenticated using(id=auth.uid());
create policy edit_profile on profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
alter table organizations enable row level security;
create policy org_read on organizations for select to authenticated using(owner_id=auth.uid() or exists(select 1 from organization_members where organization_id=id and user_id=auth.uid()));
alter table organization_members enable row level security;
create policy org_member_read on organization_members for select to authenticated using(user_id=auth.uid() or org_owner(organization_id));
do $$ declare t text; begin foreach t in array array['projects','project_members','milestones','milestone_criteria','milestone_submissions','evidence_files','inspections','disputes','dispute_participants','assessments','genlayer_transactions','appeals','activity_events'] loop execute format('alter table public.%I enable row level security',t);execute format('create policy member_read on public.%I for select to authenticated using (public.project_role(%I) is not null)',t,case when t='projects' then 'id' else 'project_id' end);end loop;end $$;
alter table notifications enable row level security;
create policy notification_read on notifications for select to authenticated using(user_id=auth.uid());
create policy notification_seen on notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke update on notifications from authenticated;
grant update(read) on notifications to authenticated;
-- All writes go through checked transactional functions, never client role claims.
create function public.workspace_action(action text,payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid();pid uuid;mid uuid;rid uuid:=gen_random_uuid();oid uuid;role_name text;m milestones;s milestone_submissions;aid uuid;
begin
 if actor is null then raise exception 'Authentication required';end if;
 if not public.consume_limit(case when action='assessment_request' then 'assessment' else 'write' end,60) then raise exception 'Rate limit reached';end if;
 if action='organization' then insert into organizations(id,name,owner_id) values(rid,payload->>'name',actor);insert into organization_members values(rid,actor,'owner',now());return rid;end if;
 if action='project' then
  select id into oid from organizations where owner_id=actor order by created_at limit 1;
  if oid is null then insert into organizations(name,owner_id) values('My organization',actor) returning id into oid;insert into organization_members values(oid,actor,'owner',now());end if;
  insert into projects(id,organization_id,owner_id,name,reference,address,description,start_date,target_date,currency,agreement_reference) values(rid,oid,actor,payload->>'name',payload->>'reference',payload->>'address',coalesce(payload->>'description',''),nullif(payload->>'start_date','')::date,nullif(payload->>'target_date','')::date,coalesce(payload->>'currency','NGN'),payload->>'agreement_reference');
  insert into project_members values(rid,actor,'owner',now());pid:=rid;
 else
  pid:=(payload->>'project_id')::uuid;role_name:=project_role(pid);if role_name is null then raise exception 'Access denied';end if;
  if action='member' then
   if role_name<>'owner' then raise exception 'Owner required';end if;
   if payload->>'role' not in ('contractor','inspector','manager') then raise exception 'Invalid role';end if;
   insert into project_members(project_id,user_id,role) values(pid,(payload->>'user_id')::uuid,payload->>'role');
   insert into notifications(project_id,user_id,message) values(pid,(payload->>'user_id')::uuid,'You were added to a construction project');
  elsif action='milestone' then
   if role_name<>'owner' then raise exception 'Owner required';end if;
   insert into milestones(id,project_id,title,criteria,due_date,value,payment_conditions,scope,deliverables,required_evidence) values(rid,pid,payload->>'title',to_jsonb(regexp_split_to_array(trim(payload->>'criteria'),E'\n+')),(payload->>'due_date')::date,(payload->>'value')::numeric,payload->>'payment_conditions',coalesce(payload->>'scope',''),to_jsonb(regexp_split_to_array(coalesce(payload->>'deliverables',''),E'\n+')),to_jsonb(regexp_split_to_array(coalesce(payload->>'required_evidence',''),E'\n+')));
   insert into milestone_criteria(project_id,milestone_id,version,criteria,agreed_by) select pid,rid,1,criteria,actor from milestones where id=rid;
  else
   mid:=(payload->>'milestone_id')::uuid;select * into m from milestones where id=mid and project_id=pid for update;if not found then raise exception 'Milestone unavailable';end if;
   if action in ('accept','request_evidence') and role_name not in ('owner','manager') then raise exception 'Owner or manager required';end if;
   if action='submit' then
    if role_name not in ('owner','contractor') or m.status not in ('draft','additional_evidence') then raise exception 'Invalid submission';end if;
    insert into milestone_submissions(project_id,milestone_id,criteria_version,criteria_snapshot,evidence_manifest,actor_id) select pid,mid,m.version,m.criteria,coalesce(jsonb_agg(jsonb_build_object('id',id,'hash',hash,'description',description,'source','uploader supplied; unverified')), '[]'::jsonb),actor from evidence_files where milestone_id=mid;
    update milestones set status='submitted',updated_at=now() where id=mid;
   elsif action in ('accept','request_evidence') then
    if m.status<>'submitted' then raise exception 'Milestone must be submitted';end if;
    update milestones set status=case when action='accept' then 'accepted' else 'additional_evidence' end,updated_at=now() where id=mid;
   elsif action='dispute' then
    if m.status not in ('submitted','accepted') or length(payload->>'reason')<10 then raise exception 'Invalid dispute';end if;
    insert into disputes(id,project_id,milestone_id,actor_id,reason,requirements) values(rid,pid,mid,actor,payload->>'reason',m.criteria);
    insert into dispute_participants(project_id,dispute_id,user_id) select pid,rid,user_id from project_members where project_id=pid;
    update milestones set status='disputed',updated_at=now() where id=mid;
   elsif action='appeal' then
    if m.status not in ('assessed','accepted','submitted','disputed') or length(payload->>'reason')<10 then raise exception 'Invalid appeal';end if;
    insert into appeals(id,project_id,milestone_id,actor_id,reason) values(rid,pid,mid,actor,payload->>'reason');update milestones set status='appeal_pending',updated_at=now() where id=mid;
   elsif action='inspection' then
    if role_name not in ('inspector','manager') then raise exception 'Inspector required';end if;
    insert into inspections(id,project_id,milestone_id,actor_id,notes,measurements) values(rid,pid,mid,actor,payload->>'notes',coalesce(payload->'measurements','{}'));
   elsif action='assessment_request' then
    if m.status not in ('submitted','disputed') then raise exception 'Submit before assessment';end if;
    select * into s from milestone_submissions where milestone_id=mid order by created_at desc limit 1;
    insert into assessments(id,project_id,milestone_id,submission_id,criteria_version,mode,manifest_hash) values(rid,pid,mid,s.id,s.criteria_version,payload->>'mode',payload->>'manifest_hash');
   else raise exception 'Unsupported operation';end if;
  end if;
 end if;
 insert into activity_events(project_id,actor_id,type,summary,record_id) values(pid,actor,action,replace(action,'_',' ')||' · '||coalesce(payload->>'title',payload->>'name',payload->>'reason','Workspace updated'),rid);
 insert into notifications(project_id,user_id,message) select pid,user_id,'Project activity: '||replace(action,'_',' ') from project_members where project_id=pid;
 return rid;
end $$;
revoke all on function public.workspace_action(text,jsonb) from public;
grant execute on function public.workspace_action(text,jsonb) to authenticated;
create function public.register_evidence(payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare mid uuid:=(payload->>'milestone_id')::uuid;actor uuid:=(payload->>'actor_id')::uuid;m milestones;rid uuid:=gen_random_uuid();begin
 if auth.role()<>'service_role' then raise exception 'Backend required';end if;
 select * into m from milestones where id=mid for update;
 if actor is null or not exists(select 1 from project_members where project_id=m.project_id and user_id=actor) or m.status not in ('draft','additional_evidence') then raise exception 'Evidence is locked or access denied';end if;
 if payload->>'path' not like m.project_id::text||'/'||actor::text||'/%' then raise exception 'Invalid storage path';end if;
 if not exists(select 1 from storage.objects where bucket_id='evidence' and name=payload->>'path') then raise exception 'Upload missing';end if;
 insert into evidence_files(id,project_id,milestone_id,actor_id,name,description,hash,path,type,size) values(rid,m.project_id,mid,actor,payload->>'name',payload->>'description',payload->>'hash',payload->>'path',payload->>'type',(payload->>'size')::bigint);
 insert into activity_events(project_id,actor_id,type,summary,record_id) values(m.project_id,actor,'evidence_upload',payload->>'name',rid);return rid;end $$;
revoke all on function public.register_evidence(jsonb) from public;grant execute on function public.register_evidence(jsonb) to service_role;
-- Internal assessment completion uses service_role only, never a browser credential.
create function public.finish_assessment(aid uuid,result jsonb,new_status text) returns void language plpgsql security definer set search_path=public as $$
declare a assessments;begin
 if auth.role()<>'service_role' then raise exception 'Backend required';end if;
 select * into a from assessments where id=aid for update;
 if a.status not in ('requested','submitted','pending','submission_unknown') then raise exception 'Assessment is immutable';end if;
 if new_status not in ('finalized','inconclusive','human_review','rejected','submission_unknown') then raise exception 'Invalid status';end if;
 update assessments set report=result,status=new_status where id=aid;
 if new_status in ('finalized','inconclusive','human_review') then update milestones set status='assessed' where id=a.milestone_id and status in ('submitted','disputed');end if;
 insert into activity_events(project_id,actor_id,type,summary,record_id) select a.project_id,actor_id,'assessment_result',new_status,aid from milestone_submissions where id=a.submission_id;
 insert into notifications(project_id,user_id,message) select a.project_id,user_id,'Assessment result: '||new_status from project_members where project_id=a.project_id;
end $$;
revoke all on function public.finish_assessment(uuid,jsonb,text) from public;grant execute on function public.finish_assessment(uuid,jsonb,text) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('evidence','evidence',false,4194304,array['image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv']) on conflict(id) do nothing;
create policy private_evidence_read on storage.objects for select to authenticated using(bucket_id='evidence' and exists(select 1 from public.evidence_files e where e.path=storage.objects.name and public.project_role(e.project_id) is not null));
create policy evidence_upload on storage.objects for insert to authenticated with check(bucket_id='evidence' and (storage.foldername(name))[2]=auth.uid()::text and public.project_role(((storage.foldername(name))[1])::uuid) is not null);
-- No UPDATE or DELETE policies for evidence, snapshots, findings, or audit events.
do $$ declare t text;begin foreach t in array array['project_members','milestones','milestone_criteria','milestone_submissions','evidence_files','inspections','disputes','dispute_participants','assessments','genlayer_transactions','appeals','activity_events','notifications'] loop execute format('create index on public.%I (project_id,created_at desc)',t);end loop;end $$;
create index on public.organization_members(user_id);
create index on public.project_members(user_id);
create index on public.evidence_files(milestone_id);
create index on public.assessments(submission_id);
create index on public.notifications(user_id,read);
