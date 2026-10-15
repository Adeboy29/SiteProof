alter table public.assessments drop constraint assessments_status_check;
alter table public.assessments add constraint assessments_status_check check(status in ('requested','submitted','pending','finalized','rejected','inconclusive','human_review','submission_unknown','preflight_failed'));
create function public.retry_failed_assessment(aid uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare a assessments;begin
 select * into a from assessments where id=aid for update;
 if auth.uid() is null or project_role(a.project_id) is null or a.status<>'preflight_failed' or exists(select 1 from genlayer_transactions where assessment_id=aid) then raise exception 'Retry not permitted';end if;
 if not exists(select 1 from milestones where id=a.milestone_id and version=a.criteria_version and status in ('submitted','disputed')) then raise exception 'Milestone version or workflow changed';end if;
 if not consume_limit('assessment',5) then raise exception 'Rate limit reached';end if;
 update assessments set status='requested' where id=aid;
 insert into activity_events(project_id,actor_id,type,summary,record_id) values(a.project_id,auth.uid(),'assessment_retry','Retry after a proven pre-broadcast failure',aid);return aid;
end $$;
revoke all on function public.retry_failed_assessment(uuid) from public;grant execute on function public.retry_failed_assessment(uuid) to authenticated;
create or replace function public.finish_assessment(aid uuid,result jsonb,new_status text) returns void language plpgsql security definer set search_path=public as $$
declare a assessments;begin
 if auth.role()<>'service_role' then raise exception 'Backend required';end if;
 select * into a from assessments where id=aid for update;
 if a.status not in ('requested','submitted','pending','submission_unknown') then raise exception 'Assessment is immutable';end if;
 if new_status not in ('finalized','inconclusive','human_review','rejected','submission_unknown','preflight_failed') then raise exception 'Invalid status';end if;
 if new_status='preflight_failed' and exists(select 1 from genlayer_transactions where assessment_id=aid) then raise exception 'Cannot retry a broadcast transaction';end if;
 update assessments set report=result,status=new_status where id=aid;
 if new_status in ('finalized','inconclusive','human_review') then update milestones set status='assessed' where id=a.milestone_id and status in ('submitted','disputed');end if;
 insert into activity_events(project_id,actor_id,type,summary,record_id) select a.project_id,actor_id,'assessment_result',new_status,aid from milestone_submissions where id=a.submission_id;
 insert into notifications(project_id,user_id,message) select a.project_id,user_id,'Assessment result: '||new_status from project_members where project_id=a.project_id;
end $$;
