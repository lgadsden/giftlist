import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Muted, Screen, Title } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/lib/auth';

export default function ProfileScreen() {
  const { profile, user, signOut } = useAuth();

  return (
    <Screen>
      <Title>Profile</Title>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile?.display_name ?? '?').slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{profile?.display_name ?? 'Loading…'}</Text>
        <Muted>@{profile?.username ?? '…'}</Muted>
        <Muted>{user?.email ?? ''}</Muted>
      </View>

      <View style={styles.stats}>
        <Card style={styles.stat}>
          <Text style={styles.statNum}>—</Text>
          <Text style={styles.statLabel}>WISHLISTS</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statNum}>—</Text>
          <Text style={styles.statLabel}>FRIENDS</Text>
        </Card>
      </View>

      <Card style={{ gap: 12, marginTop: 8 }}>
        <Text style={styles.menu}>Account Settings</Text>
        <Text style={styles.menu}>Notification Preferences</Text>
        <Text style={styles.menu}>Privacy & Security</Text>
      </Card>

      <View style={{ marginTop: 16 }}>
        <Button label="Log out" variant="soft" onPress={() => signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 20, marginBottom: 20, gap: 4 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: theme.colors.pink,
    backgroundColor: theme.colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 32,
    color: theme.colors.pink,
  },
  name: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 22,
    color: theme.colors.ink,
  },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statNum: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 28,
    color: theme.colors.pink,
  },
  statLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    color: theme.colors.muted,
    marginTop: 4,
  },
  menu: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: theme.colors.ink,
    paddingVertical: 6,
  },
});
