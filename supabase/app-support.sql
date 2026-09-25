-- Optional application helper: administrator role/location/activation updates.
-- Run after the three approved scope migrations. No new tables or business data.
-- Account creation still uses the server-only Auth administration API.
begin;
create or replace function public.update_user_access(
  p_user_account_id uuid,p_display_name text,p_user_role text,p_location_id uuid,p_is_active boolean
) returns uuid language plpgsql security definer set search_path = ''
as $$
begin
  -- Serialize privilege mutations before checking who is authorized or counting admins.
  lock table public.user_accounts in share row exclusive mode;
  perform private.require_admin();
  if p_is_active is null or nullif(btrim(p_display_name),'') is null then
    raise exception 'Name and active state required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.user_accounts where user_account_id=p_user_account_id) then
    raise exception 'Account not found' using errcode = '22023';
  end if;
  if (not p_is_active or p_user_role not in ('owner','manager')) and not exists (
    select 1 from public.user_accounts where is_active and user_role in ('owner','manager')
      and user_account_id<>p_user_account_id
  ) then raise exception 'Keep at least one active administrator' using errcode = '23514'; end if;
  update public.user_accounts set display_name=btrim(p_display_name),user_role=p_user_role,
    location_id=p_location_id,is_active=p_is_active where user_account_id=p_user_account_id;
  return p_user_account_id;
end
$$;
revoke all on function public.update_user_access(uuid,text,text,uuid,boolean) from public,anon;
grant execute on function public.update_user_access(uuid,text,text,uuid,boolean) to authenticated;
commit;
