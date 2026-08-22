-- Allow re-claim after cancel by scoping uniqueness to active rows.
alter table public.reservations drop constraint if exists reservations_one_active;

create unique index reservations_one_active
  on public.reservations (gift_id)
  where status in ('reserved', 'purchased');

-- Reserver may delete their own reservation (release claim).
create policy "reservations_delete_own"
  on public.reservations for delete to authenticated
  using (reserved_by = auth.uid());
