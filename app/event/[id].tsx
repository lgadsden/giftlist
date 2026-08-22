import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, Card, Muted, Screen } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/lib/auth';
import { formatWishlistDate } from '@/lib/eventCovers';
import {
  giftingEventKindLabel,
  giftingEventStatusLabel,
  type GiftingEventMemberStatus,
  type GiftingEventStatus,
} from '@/lib/events';
import { supabase } from '@/lib/supabase';

type EventRow = {
  id: string;
  title: string;
  kind: 'secret_santa';
  status: GiftingEventStatus;
  host_id: string;
  event_date: string | null;
  budget: number | null;
  notes: string | null;
};

type MemberRow = {
  user_id: string;
  status: GiftingEventMemberStatus;
  wishlist_id: string | null;
  display_name: string;
  username: string;
};

type MyList = { id: string; title: string };

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [myLists, setMyLists] = useState<MyList[]>([]);
  const [giftee, setGiftee] = useState<{
    id: string;
    display_name: string;
    wishlist_id: string | null;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id || !user) return;

    const { data: ev } = await supabase
      .from('gifting_events')
      .select('id, title, kind, status, host_id, event_date, budget, notes')
      .eq('id', id)
      .maybeSingle();
    setEvent((ev as EventRow | null) ?? null);

    const { data: memberRows } = await supabase
      .from('gifting_event_members')
      .select('user_id, status, wishlist_id')
      .eq('event_id', id);
    const rows = (memberRows as { user_id: string; status: GiftingEventMemberStatus; wishlist_id: string | null }[]) ?? [];
    const userIds = rows.map((r) => r.user_id);
    let byId: Record<string, { display_name: string; username: string }> = {};
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .in('id', userIds);
      byId = Object.fromEntries(
        ((profiles as { id: string; display_name: string; username: string }[]) ?? []).map((p) => [
          p.id,
          { display_name: p.display_name, username: p.username },
        ]),
      );
    }
    setMembers(
      rows.map((r) => ({
        ...r,
        display_name: byId[r.user_id]?.display_name ?? 'Someone',
        username: byId[r.user_id]?.username ?? 'unknown',
      })),
    );

    const { data: lists } = await supabase
      .from('wishlists')
      .select('id, title')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false });
    setMyLists((lists as MyList[]) ?? []);

    const { data: assignment } = await supabase
      .from('gifting_event_assignments')
      .select('receiver_id')
      .eq('event_id', id)
      .eq('giver_id', user.id)
      .maybeSingle();

    if (assignment?.receiver_id) {
      const receiverId = assignment.receiver_id as string;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', receiverId)
        .maybeSingle();
      const receiverMember = rows.find((r) => r.user_id === receiverId);
      setGiftee({
        id: receiverId,
        display_name: (profile as { display_name: string } | null)?.display_name ?? 'Your giftee',
        wishlist_id: receiverMember?.wishlist_id ?? null,
      });
    } else {
      setGiftee(null);
    }
  }, [id, user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const me = members.find((m) => m.user_id === user?.id);
  const isHost = event?.host_id === user?.id;
  const joinedCount = members.filter((m) => m.status === 'joined').length;

  const join = async () => {
    if (!id || !user) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('gifting_event_members')
        .update({ status: 'joined' })
        .eq('event_id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      await load();
    } catch (e) {
      Alert.alert('Could not join', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const attachWishlist = async (wishlistId: string | null) => {
    if (!id || !user) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('gifting_event_members')
        .update({ wishlist_id: wishlistId })
        .eq('event_id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      await load();
    } catch (e) {
      Alert.alert('Could not update wishlist', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const draw = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('draw_secret_santa', { p_event_id: id });
      if (error) throw error;
      await load();
    } catch (e) {
      Alert.alert('Could not draw names', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const openGifteeList = async () => {
    if (!giftee) return;
    if (giftee.wishlist_id) {
      router.push(`/wishlist/${giftee.wishlist_id}`);
      return;
    }
    router.push(`/friend/${giftee.id}`);
  };

  if (!event) {
    return (
      <Screen>
        <Muted>Loading event…</Muted>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: 14, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }>
        <Text style={styles.heading}>{event.title}</Text>
        <Text style={styles.summary}>
          {giftingEventKindLabel(event.kind)} · {giftingEventStatusLabel(event.status)}
          {event.event_date ? ` · ${formatWishlistDate(event.event_date)}` : ''}
          {event.budget != null ? ` · $${Number(event.budget).toFixed(0)} budget` : ''}
        </Text>
        {event.notes ? <Muted>{event.notes}</Muted> : null}

        {giftee ? (
          <Card style={styles.gifteeCard} testID="event-giftee-card">
            <Text style={styles.gifteeLabel}>You&apos;re shopping for</Text>
            <Text style={styles.gifteeName}>{giftee.display_name}</Text>
            <Button
              label={giftee.wishlist_id ? 'Open their wishlist' : 'View their lists'}
              onPress={openGifteeList}
              testID="event-open-giftee"
            />
          </Card>
        ) : null}

        {me?.status === 'invited' ? (
          <Button label="Join this event" onPress={join} loading={busy} testID="event-join" />
        ) : null}

        {me?.status === 'joined' ? (
          <Card style={{ gap: 10 }}>
            <Text style={styles.section}>Your wishlist for this event</Text>
            <Muted>Friends who draw you will open this list.</Muted>
            {myLists.length === 0 ? (
              <Button label="Create a wishlist" variant="soft" onPress={() => router.push('/wishlist/create')} />
            ) : (
              myLists.map((list) => {
                const on = me.wishlist_id === list.id;
                return (
                  <Pressable
                    key={list.id}
                    onPress={() => void attachWishlist(on ? null : list.id)}
                    style={styles.listPick}
                    testID={`event-attach-${list.title}`}>
                    <Text style={styles.check}>{on ? '☑' : '☐'}</Text>
                    <Text style={styles.listPickText}>{list.title}</Text>
                  </Pressable>
                );
              })
            )}
          </Card>
        ) : null}

        <Text style={styles.section}>
          Participants ({joinedCount} joined · {members.length} total)
        </Text>
        {members.map((m) => (
          <Card key={m.user_id} style={styles.memberRow} testID={`event-member-${m.username}`}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{m.display_name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>
                {m.display_name}
                {m.user_id === event.host_id ? ' · Host' : ''}
              </Text>
              <Muted>
                @{m.username} · {m.status === 'joined' ? 'Joined' : 'Invited'}
                {m.wishlist_id ? ' · List ready' : ''}
              </Muted>
            </View>
          </Card>
        ))}

        {isHost && event.status !== 'locked' ? (
          <Card style={{ gap: 10 }}>
            <Text style={styles.section}>Host controls</Text>
            <Muted>
              {joinedCount < 2
                ? 'Wait until at least 2 people have joined, then draw names.'
                : event.status === 'drawn'
                  ? 'Names are drawn. You can re-draw if someone joins late.'
                  : 'When everyone has joined, draw names.'}
            </Muted>
            <Button
              label={event.status === 'drawn' ? 'Re-draw names' : 'Draw names'}
              onPress={draw}
              loading={busy}
              testID="event-draw"
            />
          </Card>
        ) : null}

        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <MaterialCommunityIcons name="arrow-left" size={18} color={theme.colors.muted} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 28,
    color: theme.colors.ink,
    letterSpacing: -0.4,
  },
  summary: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: theme.colors.pink,
  },
  section: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: theme.colors.ink,
    marginTop: 4,
  },
  gifteeCard: {
    gap: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.pink,
    backgroundColor: theme.colors.pinkSoft,
  },
  gifteeLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: theme.colors.muted,
  },
  gifteeName: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 24,
    color: theme.colors.ink,
  },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.sageSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: theme.colors.sage,
  },
  memberName: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: theme.colors.ink,
  },
  listPick: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  check: { fontSize: 18, color: theme.colors.sage },
  listPickText: { fontFamily: 'DMSans_500Medium', fontSize: 15, color: theme.colors.ink },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  backText: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: theme.colors.muted },
});
