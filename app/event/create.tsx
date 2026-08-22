import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DateField } from '@/components/DateField';
import { Button, Field, Muted, Screen, Title } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/lib/auth';
import { parseBudgetInput } from '@/lib/events';
import { supabase } from '@/lib/supabase';

export default function CreateEventScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [budgetText, setBudgetText] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<{ id: string; display_name: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!user || loaded) return;
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
        const { data } = await supabase.from('profiles').select('id, display_name').in('id', ids);
        setFriends((data as { id: string; display_name: string }[]) ?? []);
      }
      setLoaded(true);
    })();
  }, [user, loaded]);

  const toggleFriend = (id: string) => {
    setFriendIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const create = async () => {
    if (!user || !title.trim()) {
      Alert.alert('Title required', 'Name your Secret Santa event.');
      return;
    }
    setBusy(true);
    try {
      const { data: event, error } = await supabase
        .from('gifting_events')
        .insert({
          title: title.trim(),
          kind: 'secret_santa',
          status: 'open',
          host_id: user.id,
          event_date: eventDate.trim() || null,
          budget: parseBudgetInput(budgetText),
          notes: notes.trim() || null,
        })
        .select('id')
        .single();
      if (error || !event) throw error ?? new Error('Create failed');

      const members = [
        { event_id: event.id, user_id: user.id, status: 'joined' as const },
        ...friendIds.map((user_id) => ({
          event_id: event.id,
          user_id,
          status: 'invited' as const,
        })),
      ];
      const { error: memberError } = await supabase.from('gifting_event_members').insert(members);
      if (memberError) throw memberError;

      router.replace(`/event/${event.id}`);
    } catch (e) {
      const message =
        e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
          ? (e as { message: string }).message
          : e instanceof Error
            ? e.message
            : 'Unknown error';
      Alert.alert('Could not create event', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
        <Title>Secret Santa</Title>
        <Muted>Invite friends, draw names, then shop from their wishlist.</Muted>

        <Field
          label="Event name"
          value={title}
          onChangeText={setTitle}
          placeholder="Office Secret Santa 2026"
          testID="event-title-input"
        />

        <DateField
          label="Exchange date (optional)"
          value={eventDate}
          onChange={setEventDate}
          testID="event-date-input"
        />

        <Field
          label="Budget (optional)"
          value={budgetText}
          onChangeText={setBudgetText}
          keyboardType="decimal-pad"
          placeholder="25.00"
          testID="event-budget-input"
        />

        <Field
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Wrap gifts, bring to the party…"
          multiline
          testID="event-notes-input"
        />

        <Text style={styles.label}>Invite friends</Text>
        {friends.length === 0 ? (
          <Muted>Add friends first, then invite them here.</Muted>
        ) : (
          friends.map((f) => {
            const on = friendIds.includes(f.id);
            return (
              <Pressable
                key={f.id}
                onPress={() => toggleFriend(f.id)}
                style={styles.shareRow}
                testID={`event-invite-${f.display_name}`}>
                <Text style={styles.check}>{on ? '☑' : '☐'}</Text>
                <Text style={styles.shareName}>{f.display_name}</Text>
              </Pressable>
            );
          })
        )}

        <Button label="Create event" onPress={create} loading={busy} testID="create-event-submit" />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
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
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  check: { fontSize: 18, color: theme.colors.sage },
  shareName: { fontFamily: 'DMSans_500Medium', fontSize: 15, color: theme.colors.ink },
});
