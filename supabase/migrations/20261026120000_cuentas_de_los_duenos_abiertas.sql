-- Los dueños crean su cuenta desde el panel sin que nadie les pase su correo: las primeras cuentas nuevas entran
-- como administración. Para que no sea una puerta abierta, el número de cuentas que pueden entrar así es limitado
-- (open_slots): al agotarse, cualquier cuenta nueva queda sin acceso y solo entran los correos de staff_invites.

create table public.staff_signup (
  singleton   boolean primary key default true check (singleton),
  open_slots  integer not null default 0 check (open_slots >= 0)
);

comment on table public.staff_signup is 'Cuántas cuentas nuevas más pueden entrar al panel como administración al registrarse. Se ajusta desde el SQL Editor.';

alter table public.staff_signup enable row level security;
revoke all on public.staff_signup from anon, authenticated;
grant select, insert, update, delete on public.staff_signup to service_role;

-- Alex y Brigitte: dos cuentas.
insert into public.staff_signup (singleton, open_slots) values (true, 2);

create or replace function app.grant_staff_from_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.staff_invites;
  v_role public.app_role;
  v_slot integer;
begin
  select * into v_invite from public.staff_invites where email = lower(btrim(new.email));
  if found then
    v_role := v_invite.role;
  else
    -- Cuenta nueva sin invitación: usa uno de los cupos abiertos, si quedan.
    update public.staff_signup set open_slots = open_slots - 1 where open_slots > 0 returning open_slots into v_slot;
    if not found then
      return new;
    end if;
    v_role := 'admin';
  end if;

  insert into public.staff_members (user_id, role, full_name, is_active)
  values (
    new.id,
    v_role,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), v_invite.full_name, new.email),
    true
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
