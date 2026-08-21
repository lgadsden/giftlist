-- Fix INSERT…RETURNING on wishlists: SELECT policy previously only used
-- can_view_wishlist(), whose subquery cannot see the in-flight inserted row.
drop policy if exists "wishlists_select_visible" on public.wishlists;

create policy "wishlists_select_visible"
  on public.wishlists for select to authenticated
  using (
    owner_id = auth.uid()
    or public.can_view_wishlist(id, auth.uid())
  );
