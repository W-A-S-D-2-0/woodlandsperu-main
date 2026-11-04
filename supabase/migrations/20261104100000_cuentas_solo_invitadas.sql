-- Cierra el registro abierto (20261026130000_cuentas_sin_cupo): una cuenta nueva ya NO entra como administración.
-- Solo queda como personal quien tenga su correo en staff_invites, con el rol de la invitación. Cualquier otra cuenta
-- de Supabase Auth se crea sin acceso al panel (no aparece en staff_members).
--
-- Para dar acceso: en el SQL Editor,
--   insert into public.staff_invites (email, role, full_name) values ('correo@empresa.pe', 'admin', 'Nombre Apellido');
-- y luego crear la cuenta en Authentication → Users (o invitarla por correo). Si la cuenta ya existía, agregarla
-- directo a staff_members (ver README).
--
-- No quita a nadie: las cuentas que entraron mientras el registro estaba abierto siguen en staff_members.
-- Revisarlas a mano y desactivar las que no sean del equipo (is_active = false).

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
  if not found then
    return new;
  end if;

  insert into public.staff_members (user_id, role, full_name, is_active)
  values (
    new.id,
    v_invite.role,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), v_invite.full_name, new.email),
    true
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function app.grant_staff_from_invite() from public, anon, authenticated;
