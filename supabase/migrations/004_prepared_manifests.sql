create table public.prepared_manifests(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects,submission_id uuid not null references public.milestone_submissions,manifest jsonb not null,approved_by uuid not null references auth.users,created_at timestamptz not null default now(),unique(submission_id));
alter table public.prepared_manifests enable row level security;
create policy manifest_read on public.prepared_manifests for select to authenticated using(project_role(project_id) is not null);
create function public.approve_manifest(sid uuid,evidence_summaries jsonb,inspection_summaries jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare s milestone_submissions;rid uuid;item jsonb;rec jsonb;prepared jsonb:='[]';prepared_inspections jsonb:='[]';i inspections;begin
 select * into s from milestone_submissions where id=sid;
 if project_role(s.project_id) is null or project_role(s.project_id) not in ('owner','manager') then raise exception 'Owner or manager required';end if;
 if jsonb_typeof(evidence_summaries)<>'array' or jsonb_typeof(inspection_summaries)<>'array' then raise exception 'Invalid manifest';end if;
 for item in select value from jsonb_array_elements(evidence_summaries) loop
  select value into rec from jsonb_array_elements(s.evidence_manifest) where value->>'id'=item->>'id';
  if rec is null or length(item->>'description') not between 1 and 5000 then raise exception 'Invalid evidence summary';end if;
  prepared:=prepared||jsonb_build_array(jsonb_build_object('id',rec->>'id','hash',rec->>'hash','description',item->>'description','source','human-redacted statement; original file not processed by contract'));
 end loop;
 for item in select value from jsonb_array_elements(inspection_summaries) loop
  select * into i from inspections where id=(item->>'id')::uuid and milestone_id=s.milestone_id;
  if i.id is null or length(item->>'notes') not between 1 and 5000 then raise exception 'Invalid inspection reference';end if;
  prepared_inspections:=prepared_inspections||jsonb_build_array(jsonb_build_object('id',i.id,'notes',item->>'notes','source','redacted attributed inspection; factual correctness not guaranteed'));
 end loop;
 insert into prepared_manifests(project_id,submission_id,approved_by,manifest) values(s.project_id,s.id,auth.uid(),jsonb_build_object('milestone_id',s.milestone_id,'criteria_version',s.criteria_version,'criteria',s.criteria_snapshot,'evidence',prepared,'inspections',prepared_inspections,'preparation','Human-reviewed redacted summaries. No automated extraction. Original documents remain private.')) returning id into rid;
 insert into activity_events(project_id,actor_id,type,summary,record_id) values(s.project_id,auth.uid(),'manifest_approved','Approved redacted evidence manifest for public blockchain disclosure',rid);return rid;
end $$;
revoke all on function public.approve_manifest(uuid,jsonb,jsonb) from public;grant execute on function public.approve_manifest(uuid,jsonb,jsonb) to authenticated;
