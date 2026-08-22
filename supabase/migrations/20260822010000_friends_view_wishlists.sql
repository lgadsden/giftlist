-- Friends can view each other's wishlists (matches "View Wishlist" on Friends tab).
-- Explicit shares/groups still work for non-friends (e.g. group-only shares).

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
    select 1 from public.wishlists w
    where w.id = wid and public.is_friend(w.owner_id, uid)
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
