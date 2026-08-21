import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Brand, Card, Muted, Screen } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/lib/auth';
import { eventTypeLabel, type EventType } from '@/lib/domain';
import { supabase } from '@/lib/supabase';

type WishlistRow = {
  id: string;
  title: string;
  event_type: EventType;
  event_date: string | null;
};

type ActivityRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
};

export default function HomeScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [lists, setLists] = useState<WishlistRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [listsRes, notifRes] = await Promise.all([
      supabase
        .from('wishlists')
        .select('id, title, event_type, event_date')
        .order('updated_at', { ascending: false })
        .limit(8),
      supabase
        .from('notifications')
        .select('id, title, body, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);
    setLists((listsRes.data as WishlistRow[]) ?? []);
    setActivity((notifRes.data as ActivityRow[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen style={{ paddingTop: 8 }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120, gap: 16 }}
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
          <Brand />
          <Muted>{`Welcome back, ${profile?.display_name ?? 'friend'}`}</Muted>
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.section}>My Lists</Text>
          <Pressable onPress={() => router.push('/(tabs)/lists')}>
            <Text style={styles.link}>See All ›</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {lists.length === 0 ? (
            <Card style={{ width: 220 }}>
              <Text style={styles.cardTitle}>No lists yet</Text>
              <Muted>Tap + to create your first wishlist.</Muted>
            </Card>
          ) : (
            lists.map((list) => (
              <Pressable key={list.id} onPress={() => router.push(`/wishlist/${list.id}`)}>
                <Card style={styles.listCard}>
                  <View style={styles.listHero}>
                    <Text style={styles.badge}>{eventTypeLabel(list.event_type)}</Text>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {list.title}
                  </Text>
                  <Muted>{list.event_date ?? 'No date'}</Muted>
                </Card>
              </Pressable>
            ))
          )}
        </ScrollView>

        <Text style={styles.section}>Friend Activity</Text>
        {activity.length === 0 ? (
          <Card>
            <Muted>Friend requests, shares, and reservations will show up here.</Muted>
          </Card>
        ) : (
          activity.map((item) => (
            <Card key={item.id} style={{ gap: 4 }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.body ? <Muted>{item.body}</Muted> : null}
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, marginBottom: 4 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  section: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 18,
    color: theme.colors.ink,
  },
  link: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: theme.colors.pink,
  },
  listCard: { width: 180, padding: 0, overflow: 'hidden' },
  listHero: {
    height: 88,
    backgroundColor: theme.colors.sage,
    justifyContent: 'flex-start',
    padding: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.35)',
    color: '#fff',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
  },
  cardTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: theme.colors.ink,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
});
