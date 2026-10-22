-- Secret Santa / gifting events

create type public.gifting_event_kind as enum ('secret_santa');
create type public.gifting_event_status as enum ('open', 'drawn', 'locked');
create type public.gifting_event_member_status as enum ('invited', 'joined');

create table public.gifting_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind public.gifting_event_kind not null default 'secret_santa',
  status public.gifting_event_status not null default 'open',
  host_id uuid not null references public.profiles (id) on delete cascade,
  event_date date,
  budget numeric(12, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gifting_event_members (
  event_id uuid not null references public.gifting_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.gifting_event_member_status not null default 'invited',
  wishlist_id uuid references public.wishlists (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table public.gifting_event_assignments (
  event_id uuid not null references public.gifting_events (id) on delete cascade,
  giver_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, giver_id),
  constraint gifting_event_assignments_no_self check (giver_id <> receiver_id),
  constraint gifting_event_assignments_one_receiver unique (event_id, receiver_id)
);

create index gifting_event_members_user_idx on public.gifting_event_members (user_id);
create index gifting_events_host_idx on public.gifting_events (host_id);

create or replace function public.is_event_member(eid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.gifting_event_members m
    where m.event_id = eid and m.user_id = uid
  );
$$;

create or replace function public.is_event_host(eid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.gifting_events e
    where e.id = eid and e.host_id = uid
  );
$$;

-- Random Secret Santa draw (derangement). Host only; requires 2+ joined members.
create or replace function public.draw_secret_santa(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_status public.gifting_event_status;
  v_ids uuid[];
  v_n int;
  v_givers uuid[];
  v_receivers uuid[];
  v_ok boolean;
  v_attempt int;
  i int;
  j int;
  tmp uuid;
begin
  select host_id, status into v_host, v_status
  from public.gifting_events
  where id = p_event_id
  for update;

  if v_host is null then
    raise exception 'Event not found';
  end if;
  if v_host <> auth.uid() then
    raise exception 'Only the host can draw names';
  end if;
  if v_status = 'locked' then
    raise exception 'Event is locked';
  end if;

  select coalesce(array_agg(user_id order by user_id), '{}')
  into v_ids
  from public.gifting_event_members
  where event_id = p_event_id and status = 'joined';

  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n < 2 then
    raise exception 'Need at least 2 joined participants to draw';
  end if;

  v_givers := v_ids;
  v_ok := false;
  v_attempt := 0;

  while not v_ok and v_attempt < 80 loop
    v_attempt := v_attempt + 1;
    v_receivers := v_ids;

    -- Fisher–Yates shuffle
    for i in reverse 2..v_n loop
      j := 1 + floor(random() * i)::int;
      tmp := v_receivers[i];
      v_receivers[i] := v_receivers[j];
      v_receivers[j] := tmp;
    end loop;

    v_ok := true;
    for i in 1..v_n loop
      if v_givers[i] = v_receivers[i] then
        v_ok := false;
        exit;
      end if;
    end loop;
  end loop;

  -- Guaranteed derangement via cyclic shift on shuffled order
  if not v_ok then
    v_receivers := v_ids;
    for i in reverse 2..v_n loop
      j := 1 + floor(random() * i)::int;
      tmp := v_receivers[i];
      v_receivers[i] := v_receivers[j];
      v_receivers[j] := tmp;
    end loop;
    v_givers := v_receivers;
    v_receivers := v_receivers[2:v_n] || v_receivers[1:1];
  end if;

  delete from public.gifting_event_assignments where event_id = p_event_id;

  for i in 1..v_n loop
    insert into public.gifting_event_assignments (event_id, giver_id, receiver_id)
    values (p_event_id, v_givers[i], v_receivers[i]);
  end loop;

  update public.gifting_events
  set status = 'drawn', updated_at = now()
  where id = p_event_id;
end;
$$;

grant execute on function public.draw_secret_santa(uuid) to authenticated;

alter table public.gifting_events enable row level security;
alter table public.gifting_event_members enable row level security;
alter table public.gifting_event_assignments enable row level security;

create policy "gifting_events_select_member"
  on public.gifting_events for select to authenticated
  using (public.is_event_member(id, auth.uid()) or host_id = auth.uid());

create policy "gifting_events_insert_host"
  on public.gifting_events for insert to authenticated
  with check (host_id = auth.uid());

create policy "gifting_events_update_host"
  on public.gifting_events for update to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

create policy "gifting_events_delete_host"
  on public.gifting_events for delete to authenticated
  using (host_id = auth.uid());

create policy "gifting_event_members_select"
  on public.gifting_event_members for select to authenticated
  using (public.is_event_member(event_id, auth.uid()) or public.is_event_host(event_id, auth.uid()));

-- Host invites others; user may insert themselves as joined (accept path uses update)
create policy "gifting_event_members_insert"
  on public.gifting_event_members for insert to authenticated
  with check (
    public.is_event_host(event_id, auth.uid())
    or (user_id = auth.uid() and status = 'joined')
  );

create policy "gifting_event_members_update"
  on public.gifting_event_members for update to authenticated
  using (
    public.is_event_host(event_id, auth.uid())
    or user_id = auth.uid()
  )
  with check (
    public.is_event_host(event_id, auth.uid())
    or user_id = auth.uid()
  );

create policy "gifting_event_members_delete"
  on public.gifting_event_members for delete to authenticated
  using (
    public.is_event_host(event_id, auth.uid())
    or user_id = auth.uid()
  );

-- Giver sees only their assignment; host sees all (to support redraw UX)
create policy "gifting_event_assignments_select"
  on public.gifting_event_assignments for select to authenticated
  using (
    giver_id = auth.uid()
    or public.is_event_host(event_id, auth.uid())
  );

-- Assignments are written only by draw_secret_santa (security definer)
