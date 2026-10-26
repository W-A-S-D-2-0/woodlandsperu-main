-- Crear cuenta desde el panel: solo entra de inmediato quien tenga su correo en la lista de acceso.
-- Cualquier otro correo puede registrarse, pero queda sin acceso (no aparece en staff_members).

create table public.staff_invites (
  email      text primary key check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  role       public.app_role not null default 'admin',
  full_name  text check (char_length(btrim(full_name)) between 1 and 120),
  created_at timestamptz not null default now()
);

comment on table public.staff_invites is 'Correos autorizados a crear su cuenta y entrar al panel con el rol indicado. Se administra desde el SQL Editor.';

alter table public.staff_invites enable row level security;
revoke all on public.staff_invites from anon, authenticated;
grant select, insert, update, delete on public.staff_invites to service_role;

-- Al crearse una cuenta de Supabase Auth con un correo autorizado, queda como personal activo.
create function app.grant_staff_from_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.staff_invites;
begin
  select * into v_invite from public.staff_invites where email = lower(btrim(new.email));
  if found then
    insert into public.staff_members (user_id, role, full_name, is_active)
    values (
      new.id,
      v_invite.role,
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), v_invite.full_name, new.email),
      true
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function app.grant_staff_from_invite() from public, anon, authenticated;

create trigger staff_from_invite after insert on auth.users
  for each row execute function app.grant_staff_from_invite();
