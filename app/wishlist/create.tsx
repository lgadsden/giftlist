import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DateField } from '@/components/DateField';
import { Button, Field, Muted, Screen, Title } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/lib/auth';
import { EVENT_TYPES, eventTypeLabel, type EventType } from '@/lib/domain';
import { supabase } from '@/lib/supabase';

export default function CreateWishlistScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<EventType>('general');
  const [eventDate, setEventDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<{ id: string; display_name: string }[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [loadedShareTargets, setLoadedShareTargets] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!user || loadedShareTargets) return;
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_a, user_b')
        .eq('status', 'accepted')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
      const ids = [
        ...new Set(
          (friendships ?? []).map((f: { user_a: string; user_b: string }) =>
            f.user_a === user.id ? f.user_b : f.user_a,
          ),
        ),
      ];
      if (ids.length) {
        const { data } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', ids);
        setFriends((data as { id: string; display_name: string }[]) ?? []);
      }
      const { data: memberships } = await supabase
        .from('group_members')
        .select('groups(id, name)')
        .eq('user_id', user.id);
      const gs =
        memberships
          ?.map((m: { groups: { id: string; name: string } | { id: string; name: string }[] | null }) =>
            Array.isArray(m.groups) ? m.groups[0] : m.groups,
          )
          .filter(Boolean) ?? [];
      setGroups(gs as { id: string; name: string }[]);
      setLoadedShareTargets(true);
    })();
  }, [user, loadedShareTargets]);

  const toggle = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const create = async () => {
    if (!user || !title.trim()) {
      Alert.alert('Title required');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('wishlists')
        .insert({
          owner_id: user.id,
          title: title.trim(),
          event_type: eventType,
          event_date: eventDate.trim() || null,
        })
        .select('id')
        .single();
      if (error || !data) throw error ?? new Error('Create failed');

      const shares = [
        ...friendIds.map((shared_with_user_id) => ({
          wishlist_id: data.id,
          shared_with_user_id,
        })),
        ...groupIds.map((shared_with_group_id) => ({
          wishlist_id: data.id,
          shared_with_group_id,
        })),
      ];
      if (shares.length) {
        const { error: shareError } = await supabase.from('wishlist_shares').insert(shares);
        if (shareError) throw shareError;
      }

      router.replace(`/wishlist/${data.id}`);
    } catch (e) {
      const message =
        e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
          ? (e as { message: string }).message
          : e instanceof Error
            ? e.message
            : 'Unknown error';
      Alert.alert('Could not create list', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
        <Title>New wishlist</Title>
        <Muted>Private by default — share with friends or groups below.</Muted>
        <Field label="Wishlist title" value={title} onChangeText={setTitle} placeholder="Christmas 2026" testID="wishlist-title-input" />

        <Text style={styles.label}>Event type</Text>
        <View style={styles.chips}>
          {EVENT_TYPES.map((type) => {
            const selected = type === eventType;
            return (
              <Pressable
                key={type}
                onPress={() => setEventType(type)}
                style={[styles.chip, selected && styles.chipSelected]}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {eventTypeLabel(type)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <DateField
          label="Date (optional)"
          value={eventDate}
          onChange={setEventDate}
          testID="wishlist-date-input"
        />

        <Text style={styles.label}>Share with</Text>
        {friends.map((f) => {
          const on = friendIds.includes(f.id);
          return (
            <Pressable
              key={f.id}
              onPress={() => toggle(f.id, friendIds, setFriendIds)}
              style={styles.shareRow}
              testID={`share-friend-${f.display_name}`}>
              <Text style={styles.check}>{on ? '☑' : '☐'}</Text>
              <Text style={styles.shareName}>{f.display_name}</Text>
            </Pressable>
          );
        })}
        {groups.map((g) => {
          const on = groupIds.includes(g.id);
          return (
            <Pressable key={g.id} onPress={() => toggle(g.id, groupIds, setGroupIds)} style={styles.shareRow}>
              <Text style={styles.check}>{on ? '☑' : '☐'}</Text>
              <Text style={styles.shareName}>{g.name} (group)</Text>
            </Pressable>
          );
        })}

        <Button label="Create & share" onPress={create} loading={busy} testID="create-wishlist-submit" />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} testID="create-wishlist-cancel" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.white,
  },
  chipSelected: {
    borderColor: theme.colors.sage,
    backgroundColor: '#E8F0EC',
  },
  chipText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: theme.colors.ink,
  },
  chipTextSelected: { color: theme.colors.sage, fontFamily: 'DMSans_700Bold' },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  check: { fontSize: 18, color: theme.colors.sage },
  shareName: { fontFamily: 'DMSans_500Medium', fontSize: 15, color: theme.colors.ink },
});
