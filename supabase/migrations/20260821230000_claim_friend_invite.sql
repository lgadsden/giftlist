-- Claim a friend invite token: create accepted friendship + bump use_count.
create or replace function public.claim_friend_invite(invite_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.friend_invites%rowtype;
  me uuid := auth.uid();
  a uuid;
  b uuid;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  select * into inv
  from public.friend_invites
  where token = invite_token
  for update;

  if not found then
    raise exception 'invite not found';
  end if;

  if inv.expires_at <= now() then
    raise exception 'invite expired';
  end if;

  if inv.use_count >= inv.max_uses then
    raise exception 'invite exhausted';
  end if;

  if inv.created_by = me then
    raise exception 'cannot claim your own invite';
  end if;

  if inv.created_by < me then
    a := inv.created_by;
    b := me;
  else
    a := me;
    b := inv.created_by;
  end if;

  insert into public.friendships (user_a, user_b, requester_id, status)
  values (a, b, inv.created_by, 'accepted')
  on conflict (user_a, user_b) do update
    set status = 'accepted',
        requester_id = excluded.requester_id;

  update public.friend_invites
  set use_count = use_count + 1
  where id = inv.id;

  return jsonb_build_object(
    'ok', true,
    'friend_id', inv.created_by
  );
end;
$$;

grant execute on function public.claim_friend_invite(text) to authenticated;
