import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { WishlistCover } from '@/components/WishlistCover';
import { Button, Card, Muted, Screen } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/lib/auth';
import type { EventType } from '@/lib/domain';
import { coverDateBadge, firstGiftImage } from '@/lib/eventCovers';
import { supabase } from '@/lib/supabase';

type WishlistRow = {
  id: string;
  title: string;
  event_type: EventType;
  event_date: string | null;
  coverImageUrl: string | null;
  itemCount: number;
};

type FriendListRow = WishlistRow & {
  ownerName: string;
};

type ActivityRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
};

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function initials(text: string): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

export default function HomeScreen() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const [lists, setLists] = useState<WishlistRow[]>([]);
  const [friendLists, setFriendLists] = useState<FriendListRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [listsRes, notifRes] = await Promise.all([
      supabase
        .from('wishlists')
        .select('id, title, event_type, event_date, owner_id, gifts(image_url)')
        .order('updated_at', { ascending: false })
        .limit(24),
      supabase
        .from('notifications')
        .select('id, title, body, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const rows =
      ((listsRes.data as {
        id: string;
        title: string;
        event_type: EventType;
        event_date: string | null;
        owner_id: string;
        gifts: { image_url: string | null }[] | null;
      }[]) ?? []);

    const mine = rows
      .filter((row) => row.owner_id === user?.id)
      .slice(0, 8)
      .map((row) => ({
        id: row.id,
        title: row.title,
        event_type: row.event_type,
        event_date: row.event_date,
        coverImageUrl: firstGiftImage(row.gifts),
        itemCount: row.gifts?.length ?? 0,
      }));

    const others = rows.filter((row) => row.owner_id !== user?.id).slice(0, 8);
    let friendMapped: FriendListRow[] = [];
    if (others.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in(
          'id',
          [...new Set(others.map((r) => r.owner_id))],
        );
      const byId = Object.fromEntries(
        ((profiles as { id: string; display_name: string }[]) ?? []).map((p) => [
          p.id,
          p.display_name,
        ]),
      );
      friendMapped = others.map((row) => ({
        id: row.id,
        title: row.title,
        event_type: row.event_type,
        event_date: row.event_date,
        coverImageUrl: firstGiftImage(row.gifts),
        itemCount: row.gifts?.length ?? 0,
        ownerName: byId[row.owner_id] ?? 'Friend',
      }));
    }

    setLists(mine);
    setFriendLists(friendMapped);
    setActivity((notifRes.data as ActivityRow[]) ?? []);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const firstName = (profile?.display_name ?? 'friend').split(/\s+/)[0] ?? 'friend';

  return (
    <Screen style={{ paddingTop: 4, paddingHorizontal: 0 }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
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
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcome}>Welcome back,</Text>
            <Text style={styles.hello}>Hello, {firstName}</Text>
          </View>
          <View style={styles.bell}>
            <MaterialCommunityIcons name="bell-outline" size={22} color={theme.colors.ink} />
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.section}>My Lists</Text>
          <Pressable onPress={() => router.push('/(tabs)/lists')} hitSlop={8}>
            <Text style={styles.link}>See All ›</Text>
          </Pressable>
        </View>

        {lists.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyBlob}>
              <MaterialCommunityIcons name="gift-outline" size={56} color={theme.colors.pink} />
            </View>
            <Text style={styles.emptyTitle}>No lists yet</Text>
            <Text style={styles.emptyCopy}>
              Start a wishlist so friends know exactly what you love.
            </Text>
            <View style={{ width: '100%', maxWidth: 240, marginTop: 8 }}>
              <Button label="Create your first list" onPress={() => router.push('/wishlist/create')} />
            </View>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listRail}
            decelerationRate="fast"
            snapToInterval={292}
            snapToAlignment="start">
            {lists.map((list) => (
              <Pressable
                key={list.id}
                onPress={() => router.push(`/wishlist/${list.id}`)}
                style={({ pressed }) => [pressed && { opacity: 0.94, transform: [{ translateY: -1 }] }]}>
                <Card style={styles.listCard}>
                  <WishlistCover
                    eventType={list.event_type}
                    coverImageUrl={list.coverImageUrl}
                    badge={coverDateBadge(list.event_date)}
                  />
                  <View style={styles.listBody}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {list.title}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {list.itemCount} item{list.itemCount === 1 ? '' : 's'} added
                    </Text>
                  </View>
                </Card>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {friendLists.length > 0 ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>Friends’ lists</Text>
              <Pressable onPress={() => router.push('/(tabs)/lists')} hitSlop={8}>
                <Text style={styles.link}>See All ›</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.listRail}
              decelerationRate="fast"
              snapToInterval={292}
              snapToAlignment="start">
              {friendLists.map((list) => (
                <Pressable
                  key={list.id}
                  onPress={() => router.push(`/wishlist/${list.id}`)}
                  style={({ pressed }) => [
                    pressed && { opacity: 0.94, transform: [{ translateY: -1 }] },
                  ]}>
                  <Card style={styles.listCard}>
                    <WishlistCover
                      eventType={list.event_type}
                      coverImageUrl={list.coverImageUrl}
                      badge={coverDateBadge(list.event_date)}
                    />
                    <View style={styles.listBody}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {list.title}
                      </Text>
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {list.ownerName} · {list.itemCount} item
                        {list.itemCount === 1 ? '' : 's'}
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        <Text style={[styles.section, styles.sectionPad]}>Friend Activity</Text>
        <View style={styles.activityWrap}>
          {activity.length === 0 ? (
            <Card style={styles.activityEmpty}>
              <Muted>Friend requests, shares, and reservations will show up here.</Muted>
            </Card>
          ) : (
            activity.map((item) => (
              <Card key={item.id} style={styles.activityCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(item.title)}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.activityTitle}>{item.title}</Text>
                  {item.body ? <Text style={styles.activityBody}>{item.body}</Text> : null}
                  <Text style={styles.activityTime}>{relativeTime(item.created_at)}</Text>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 12,
  },
  welcome: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: theme.colors.muted,
  },
  hello: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 28,
    color: theme.colors.ink,
    letterSpacing: -0.4,
    marginTop: 2,
  },
  bell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(26,26,31,0.06)',
    ...theme.shadow.soft,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 22,
    marginBottom: 14,
  },
  section: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 18,
    color: theme.colors.ink,
  },
  sectionPad: { paddingHorizontal: 20, marginTop: 28, marginBottom: 12 },
  link: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: theme.colors.pink,
  },
  listRail: { paddingHorizontal: 20, gap: 14, paddingBottom: 4 },
  listCard: {
    width: 278,
    padding: 0,
    overflow: 'hidden',
  },
  listBody: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 4 },
  cardTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 17,
    color: theme.colors.ink,
    letterSpacing: -0.2,
  },
  cardMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: theme.colors.muted,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 36,
    gap: 10,
  },
  emptyBlob: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: theme.colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 24,
    color: theme.colors.ink,
  },
  emptyCopy: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  activityWrap: { paddingHorizontal: 20, gap: 10 },
  activityEmpty: { paddingVertical: 18 },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(216,27,96,0.18)',
  },
  avatarText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: theme.colors.pink,
  },
  activityTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: theme.colors.ink,
  },
  activityBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: theme.colors.ink,
    lineHeight: 18,
  },
  activityTime: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 2,
  },
});
