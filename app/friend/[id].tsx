import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Card, Muted, Screen, Title } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { eventTypeLabel, type EventType } from '@/lib/domain';
import { formatWishlistDate } from '@/lib/eventCovers';
import { supabase } from '@/lib/supabase';

type Profile = {
  id: string;
  username: string;
  display_name: string;
};

type WishlistRow = {
  id: string;
  title: string;
  event_type: EventType;
  event_date: string | null;
};

export default function FriendWishlistsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lists, setLists] = useState<WishlistRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);

    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .eq('id', id)
      .maybeSingle();
    if (profileError) {
      setError(profileError.message);
      return;
    }
    setProfile((profileRow as Profile | null) ?? null);

    const { data: listRows, error: listError } = await supabase
      .from('wishlists')
      .select('id, title, event_type, event_date')
      .eq('owner_id', id)
      .order('updated_at', { ascending: false });
    if (listError) {
      setError(listError.message);
      setLists([]);
      return;
    }
    setLists((listRows as WishlistRow[]) ?? []);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const firstName = (profile?.display_name ?? 'Friend').split(/\s+/)[0] ?? 'Friend';

  return (
    <Screen>
      <Title>{profile ? `${firstName}'s lists` : 'Friend lists'}</Title>
      {profile ? <Muted>@{profile.username}</Muted> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        style={{ marginTop: 16 }}
        data={lists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 40 }}
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
        ListEmptyComponent={
          <Card>
            <Muted>
              {profile
                ? `${firstName} hasn’t shared any wishlists yet.`
                : 'Loading…'}
            </Muted>
          </Card>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`friend-wishlist-row-${item.title}`}
            accessibilityLabel={`Open ${item.title}`}
            onPress={() => router.push(`/wishlist/${item.id}`)}>
            <Card style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{item.title}</Text>
                <Muted>
                  {`${eventTypeLabel(item.event_type)}${
                    item.event_date ? ` · ${formatWishlistDate(item.event_date)}` : ''
                  }`}
                </Muted>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: theme.colors.ink,
    marginBottom: 2,
  },
  chevron: { fontSize: 22, color: theme.colors.muted },
  error: {
    marginTop: 8,
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: theme.colors.danger,
  },
});
