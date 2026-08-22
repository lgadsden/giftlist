import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Card, Muted, Screen, Title } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/lib/auth';
import { eventTypeLabel, type EventType } from '@/lib/domain';
import { formatWishlistDate } from '@/lib/eventCovers';
import { supabase } from '@/lib/supabase';

type WishlistRow = {
  id: string;
  title: string;
  event_type: EventType;
  event_date: string | null;
  owner_id: string;
  owner_name?: string;
};

export default function ListsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [mine, setMine] = useState<WishlistRow[]>([]);
  const [friends, setFriends] = useState<WishlistRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('wishlists')
      .select('id, title, event_type, event_date, owner_id')
      .order('updated_at', { ascending: false });
    const rows = (data as WishlistRow[]) ?? [];
    const owned = rows.filter((r) => r.owner_id === user?.id);
    const others = rows.filter((r) => r.owner_id !== user?.id);

    if (others.length) {
      const ownerIds = [...new Set(others.map((r) => r.owner_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', ownerIds);
      const byId = Object.fromEntries(
        ((profiles as { id: string; display_name: string }[]) ?? []).map((p) => [
          p.id,
          p.display_name,
        ]),
      );
      for (const row of others) row.owner_name = byId[row.owner_id];
    }

    setMine(owned);
    setFriends(others);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const renderRow = (item: WishlistRow, subtitle?: string) => (
    <Pressable
      testID={`wishlist-row-${item.title}`}
      accessibilityLabel={`Open wishlist ${item.title}`}
      onPress={() => router.push(`/wishlist/${item.id}`)}>
      <Card style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.title}</Text>
          <Muted>
            {subtitle
              ? subtitle
              : `${eventTypeLabel(item.event_type)}${
                  item.event_date ? ` · ${formatWishlistDate(item.event_date)}` : ''
                }`}
          </Muted>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Card>
    </Pressable>
  );

  return (
    <Screen>
      <Title>Lists</Title>
      <Muted>Your wishlists and lists from friends.</Muted>
      <FlatList
        style={{ marginTop: 16 }}
        data={[
          { key: 'mine-header', kind: 'header' as const, label: 'My lists' },
          ...mine.map((item) => ({ key: item.id, kind: 'list' as const, item })),
          ...(mine.length === 0
            ? [{ key: 'mine-empty', kind: 'empty' as const, label: 'No wishlists yet. Create one with the pink + button.' }]
            : []),
          { key: 'friends-header', kind: 'header' as const, label: 'Friends’ lists' },
          ...friends.map((item) => ({ key: item.id, kind: 'list' as const, item })),
          ...(friends.length === 0
            ? [
                {
                  key: 'friends-empty',
                  kind: 'empty' as const,
                  label: 'When you’re friends, their wishlists show up here. Or tap View Wishlist on Friends.',
                },
              ]
            : []),
        ]}
        keyExtractor={(row) => row.key}
        contentContainerStyle={{ gap: 10, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        renderItem={({ item: row }) => {
          if (row.kind === 'header') {
            return <Text style={styles.section}>{row.label}</Text>;
          }
          if (row.kind === 'empty') {
            return (
              <Card>
                <Muted>{row.label}</Muted>
              </Card>
            );
          }
          const item = row.item!;
          const isMine = item.owner_id === user?.id;
          return renderRow(
            item,
            isMine
              ? undefined
              : `${item.owner_name ?? 'Friend'} · ${eventTypeLabel(item.event_type)}${
                  item.event_date ? ` · ${formatWishlistDate(item.event_date)}` : ''
                }`,
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.pink,
    marginTop: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: theme.colors.ink,
    marginBottom: 2,
  },
  chevron: { fontSize: 22, color: theme.colors.muted },
});
