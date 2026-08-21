import { SymbolView } from 'expo-symbols';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/Colors';

function Fab() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityLabel="Create wishlist"
      testID="create-wishlist-fab"
      onPress={() => router.push('/wishlist/create')}
      style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}>
      <Text style={styles.fabPlus}>+</Text>
    </Pressable>
  );
}

function showCreateFab(pathname: string) {
  return pathname === '/' || pathname === '/lists' || pathname.endsWith('/lists');
}

export default function TabLayout() {
  const pathname = usePathname();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.sage,
          tabBarInactiveTintColor: theme.colors.muted,
          tabBarStyle: {
            backgroundColor: theme.colors.white,
            borderTopColor: theme.colors.line,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{ ios: 'house.fill', android: 'home', web: 'home' }}
                tintColor={color}
                size={24}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="lists"
          options={{
            title: 'Lists',
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{ ios: 'list.bullet', android: 'list', web: 'list' }}
                tintColor={color}
                size={24}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            title: 'Friends',
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{ ios: 'person.2.fill', android: 'group', web: 'group' }}
                tintColor={color}
                size={24}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{ ios: 'person.crop.circle', android: 'person', web: 'person' }}
                tintColor={color}
                size={24}
              />
            ),
          }}
        />
      </Tabs>
      {showCreateFab(pathname) ? <Fab /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 88,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.pink,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  fabPlus: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '400',
    marginTop: -2,
  },
});
