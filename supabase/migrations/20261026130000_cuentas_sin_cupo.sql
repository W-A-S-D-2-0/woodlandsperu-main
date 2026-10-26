-- Sin cupos: quien crea su cuenta desde el panel entra como administración (o con el rol de su invitación, si la tiene).

create or replace function app.grant_staff_from_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.staff_invites;
begin
  select * into v_invite from public.staff_invites where email = lower(btrim(new.email));

  insert into public.staff_members (user_id, role, full_name, is_active)
  values (
    new.id,
    coalesce(v_invite.role, 'admin'),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), v_invite.full_name, new.email),
    true
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop table public.staff_signup;
