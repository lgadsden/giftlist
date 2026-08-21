-- Giftlist initial schema + RLS

create extension if not exists "pgcrypto";

-- Enums
create type public.friendship_status as enum ('pending', 'accepted', 'declined', 'blocked');
create type public.group_role as enum ('admin', 'member');
create type public.event_type as enum (
  'general',
  'birthday',
  'christmas',
  'mothers_day',
  'fathers_day',
  'wedding',
  'anniversary',
  'graduation'
);
create type public.gift_type as enum ('item', 'experience', 'other');
create type public.reservation_visibility as enum ('secret', 'notify');
create type public.reservation_status as enum ('reserved', 'purchased', 'cancelled');
create type public.notification_type as enum (
  'friend_request',
  'friend_accepted',
  'list_shared',
  'gift_reserved',
  'group_invite'
);

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,30}$')
);

-- Friendships (canonical pair ordering: user_a < user_b)
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_ordered check (user_a < user_b),
  constraint friendships_unique_pair unique (user_a, user_b)
);

create table public.friend_invites (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  created_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '14 days'),
  max_uses int not null default 50,
  use_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Groups
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.group_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Wishlists
create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  event_type public.event_type not null default 'general',
  event_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wishlist_shares (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  shared_with_user_id uuid references public.profiles (id) on delete cascade,
  shared_with_group_id uuid references public.groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint wishlist_shares_one_target check (
    (shared_with_user_id is not null and shared_with_group_id is null)
    or (shared_with_user_id is null and shared_with_group_id is not null)
  )
);

create unique index wishlist_shares_user_uniq
  on public.wishlist_shares (wishlist_id, shared_with_user_id)
  where shared_with_user_id is not null;

create unique index wishlist_shares_group_uniq
  on public.wishlist_shares (wishlist_id, shared_with_group_id)
  where shared_with_group_id is not null;

-- Gifts
create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  title text not null,
  notes text,
  url text,
  image_url text,
  price numeric(12, 2),
  gift_type public.gift_type not null default 'item',
  priority int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.gifts (id) on delete cascade,
  reserved_by uuid not null references public.profiles (id) on delete cascade,
  visibility public.reservation_visibility not null default 'secret',
  status public.reservation_status not null default 'reserved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_one_active unique (gift_id)
);

-- Affiliate
create table public.affiliate_merchants (
  id text primary key,
  host_patterns text[] not null,
  tag_param text,
  tag_value text,
  enabled boolean not null default true
);

create table public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.gifts (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  destination_url text not null,
  merchant_id text references public.affiliate_merchants (id),
  tagged boolean not null default false,
  created_at timestamptz not null default now()
);

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Helpers
create or replace function public.is_friend(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.user_a = least(a, b) and f.user_b = greatest(a, b))
      )
  );
$$;

create or replace function public.is_group_member(gid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = gid and gm.user_id = uid
  );
$$;

create or replace function public.can_view_wishlist(wid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.wishlists w
    where w.id = wid and w.owner_id = uid
  )
  or exists (
    select 1 from public.wishlist_shares s
    where s.wishlist_id = wid and s.shared_with_user_id = uid
  )
  or exists (
    select 1
    from public.wishlist_shares s
    join public.group_members gm on gm.group_id = s.shared_with_group_id
    where s.wishlist_id = wid and gm.user_id = uid
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
begin
  base_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g'));
  if length(base_username) < 3 then
    base_username := 'user' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  final_username := substr(base_username, 1, 30);

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'display_name', final_username)
  )
  on conflict (id) do nothing;

  return new;
exception when unique_violation then
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    substr(final_username, 1, 22) || substr(replace(new.id::text, '-', ''), 1, 8),
    coalesce(new.raw_user_meta_data->>'display_name', final_username)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Seed Amazon merchant (tag empty until configured)
insert into public.affiliate_merchants (id, host_patterns, tag_param, tag_value, enabled)
values ('amazon', array['amazon.com', 'www.amazon.com', 'amzn.to', 'amazon.co.uk'], 'tag', null, true);

-- RLS
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.friend_invites enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_shares enable row level security;
alter table public.gifts enable row level security;
alter table public.reservations enable row level security;
alter table public.affiliate_merchants enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.notifications enable row level security;

-- Profiles
create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Friendships
create policy "friendships_select_involved"
  on public.friendships for select to authenticated
  using (user_a = auth.uid() or user_b = auth.uid());

create policy "friendships_insert_requester"
  on public.friendships for insert to authenticated
  with check (
    requester_id = auth.uid()
    and (user_a = auth.uid() or user_b = auth.uid())
  );

create policy "friendships_update_involved"
  on public.friendships for update to authenticated
  using (user_a = auth.uid() or user_b = auth.uid());

-- Friend invites
create policy "friend_invites_select_own"
  on public.friend_invites for select to authenticated
  using (created_by = auth.uid());

create policy "friend_invites_insert_own"
  on public.friend_invites for insert to authenticated
  with check (created_by = auth.uid());

create policy "friend_invites_select_by_token"
  on public.friend_invites for select to authenticated
  using (expires_at > now() and use_count < max_uses);

-- Groups
create policy "groups_select_member"
  on public.groups for select to authenticated
  using (public.is_group_member(id, auth.uid()) or created_by = auth.uid());

create policy "groups_insert_creator"
  on public.groups for insert to authenticated
  with check (created_by = auth.uid());

create policy "groups_update_admin"
  on public.groups for update to authenticated
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = id and gm.user_id = auth.uid() and gm.role = 'admin'
    )
  );

create policy "group_members_select_member"
  on public.group_members for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));

create policy "group_members_insert_admin_or_self_creator"
  on public.group_members for insert to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid() and gm.role = 'admin'
    )
  );

create policy "group_members_delete_admin_or_self"
  on public.group_members for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid() and gm.role = 'admin'
    )
  );

-- Wishlists
-- owner_id check must be inline: INSERT…RETURNING evaluates SELECT policies on the
-- new row before can_view_wishlist()'s subquery can see it.
create policy "wishlists_select_visible"
  on public.wishlists for select to authenticated
  using (
    owner_id = auth.uid()
    or public.can_view_wishlist(id, auth.uid())
  );

create policy "wishlists_insert_own"
  on public.wishlists for insert to authenticated
  with check (owner_id = auth.uid());

create policy "wishlists_update_own"
  on public.wishlists for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "wishlists_delete_own"
  on public.wishlists for delete to authenticated
  using (owner_id = auth.uid());

-- Shares
create policy "wishlist_shares_select_visible"
  on public.wishlist_shares for select to authenticated
  using (
    exists (select 1 from public.wishlists w where w.id = wishlist_id and w.owner_id = auth.uid())
    or shared_with_user_id = auth.uid()
    or public.is_group_member(shared_with_group_id, auth.uid())
  );

create policy "wishlist_shares_mutate_owner"
  on public.wishlist_shares for insert to authenticated
  with check (
    exists (select 1 from public.wishlists w where w.id = wishlist_id and w.owner_id = auth.uid())
  );

create policy "wishlist_shares_delete_owner"
  on public.wishlist_shares for delete to authenticated
  using (
    exists (select 1 from public.wishlists w where w.id = wishlist_id and w.owner_id = auth.uid())
  );

-- Gifts
create policy "gifts_select_visible"
  on public.gifts for select to authenticated
  using (public.can_view_wishlist(wishlist_id, auth.uid()));

create policy "gifts_mutate_owner"
  on public.gifts for insert to authenticated
  with check (
    exists (select 1 from public.wishlists w where w.id = wishlist_id and w.owner_id = auth.uid())
  );

create policy "gifts_update_owner"
  on public.gifts for update to authenticated
  using (
    exists (select 1 from public.wishlists w where w.id = wishlist_id and w.owner_id = auth.uid())
  );

create policy "gifts_delete_owner"
  on public.gifts for delete to authenticated
  using (
    exists (select 1 from public.wishlists w where w.id = wishlist_id and w.owner_id = auth.uid())
  );

-- Reservations: viewers see that item is reserved; owner never sees reserved_by when secret
create policy "reservations_select_visible"
  on public.reservations for select to authenticated
  using (
    exists (
      select 1
      from public.gifts g
      where g.id = gift_id and public.can_view_wishlist(g.wishlist_id, auth.uid())
    )
  );

create policy "reservations_insert_gifter"
  on public.reservations for insert to authenticated
  with check (
    reserved_by = auth.uid()
    and exists (
      select 1
      from public.gifts g
      join public.wishlists w on w.id = g.wishlist_id
      where g.id = gift_id
        and w.owner_id <> auth.uid()
        and public.can_view_wishlist(g.wishlist_id, auth.uid())
    )
  );

create policy "reservations_update_own"
  on public.reservations for update to authenticated
  using (reserved_by = auth.uid())
  with check (reserved_by = auth.uid());

-- Hide reserved_by from wishlist owners when secret via view for app reads
create or replace view public.reservations_public
with (security_invoker = true)
as
select
  r.id,
  r.gift_id,
  case
    when r.visibility = 'secret'
      and exists (
        select 1
        from public.gifts g
        join public.wishlists w on w.id = g.wishlist_id
        where g.id = r.gift_id and w.owner_id = auth.uid()
      )
      and r.reserved_by <> auth.uid()
    then null
    else r.reserved_by
  end as reserved_by,
  r.visibility,
  r.status,
  r.created_at,
  r.updated_at
from public.reservations r;

-- Affiliate merchants readable by authenticated
create policy "affiliate_merchants_select"
  on public.affiliate_merchants for select to authenticated
  using (true);

create policy "affiliate_clicks_insert_own"
  on public.affiliate_clicks for insert to authenticated
  with check (user_id = auth.uid());

create policy "affiliate_clicks_select_own"
  on public.affiliate_clicks for select to authenticated
  using (user_id = auth.uid());

-- Notifications
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.reservations_public to authenticated;
