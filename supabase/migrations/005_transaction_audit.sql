create function public.record_transaction_status(tid uuid,protocol_status text,execution text) returns void language plpgsql security definer set search_path=public as $$
declare t genlayer_transactions;actor uuid;begin
 if auth.role()<>'service_role' then raise exception 'Backend required';end if;
 select * into t from genlayer_transactions where id=tid for update;
 if t.id is null or length(protocol_status)>100 or length(execution)>100 then raise exception 'Invalid transaction';end if;
 if t.status is not distinct from protocol_status and t.execution_outcome is not distinct from execution then return;end if;
 update genlayer_transactions set status=protocol_status,execution_outcome=execution,updated_at=now() where id=tid;
 select s.actor_id into actor from milestone_submissions s join assessments a on a.submission_id=s.id where a.id=t.assessment_id;
 insert into activity_events(project_id,actor_id,type,summary,record_id) values(t.project_id,actor,'transaction_status',coalesce(protocol_status,'unknown')||' / '||coalesce(execution,'pending'),tid);
end $$;
revoke all on function public.record_transaction_status(uuid,text,text) from public;grant execute on function public.record_transaction_status(uuid,text,text) to service_role;
