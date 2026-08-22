import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Muted, Screen, Title } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/lib/auth';
import { claimInviteErrorMessage, parseClaimInvitePayload } from '@/lib/friends';
import { supabase } from '@/lib/supabase';

export default function InviteClaimScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session, loading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('Open this invite to become friends.');

  useEffect(() => {
    if (loading || !session || !token || status !== 'idle') return;
    setStatus('working');
    void (async () => {
      const { data, error } = await supabase.rpc('claim_friend_invite', {
        invite_token: token,
      });
      if (error) {
        setStatus('error');
        setMessage(claimInviteErrorMessage(error.message));
        return;
      }
      const parsed = parseClaimInvitePayload(data);
      if (!parsed.ok) {
        setStatus('error');
        setMessage(parsed.error);
        return;
      }
      setStatus('done');
      setMessage("You're friends now. Head to Friends to say hi.");
    })();
  }, [loading, session, token, status]);

  if (!loading && !session && token) {
    return (
      <Redirect href={`/(auth)?next=${encodeURIComponent(`/invite/${token}`)}`} />
    );
  }

  return (
    <Screen>
      <View style={styles.wrap} testID="invite-claim-screen">
        <Title>Friend invite</Title>
        <Muted>{status === 'working' ? 'Claiming invite…' : message}</Muted>
        {status === 'error' ? (
          <Text style={styles.error} testID="invite-claim-error">
            {message}
          </Text>
        ) : null}
        {status === 'done' ? (
          <Text style={styles.success} testID="invite-claim-success">
            {message}
          </Text>
        ) : null}
        <Button
          label="Go to Friends"
          testID="invite-go-friends"
          onPress={() => router.replace('/(tabs)/friends')}
        />
        <Button label="Home" variant="ghost" onPress={() => router.replace('/(tabs)')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', gap: 14, paddingBottom: 40 },
  error: { color: theme.colors.danger, fontFamily: 'DMSans_500Medium' },
  success: { color: theme.colors.sage, fontFamily: 'DMSans_500Medium' },
});
