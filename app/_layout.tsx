import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { Redirect, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { theme } from '@/constants/Colors';
import { AuthProvider, useAuth } from '@/lib/auth';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.colors.sage,
    background: theme.colors.background,
    card: theme.colors.white,
    text: theme.colors.ink,
    border: theme.colors.line,
    notification: theme.colors.pink,
  },
};

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const top = String(segments[0] ?? '');
  const inAuth = top === '(auth)';
  const inInvite = top === 'invite';

  if (loading) return null;

  // Invite links are public entry points; the screen itself sends guests to auth.
  if (!session && !inAuth && !inInvite) {
    return <Redirect href="/(auth)" />;
  }

  // Logged-in users on (auth) are redirected by the auth screen (honors ?next=).
  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={navTheme}>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="wishlist/[id]"
                options={{ headerShown: true, title: 'Giftlist', headerBackTitle: 'Back' }}
              />
              <Stack.Screen
                name="friend/[id]"
                options={{ headerShown: true, title: 'Wishlists', headerBackTitle: 'Back' }}
              />
              <Stack.Screen name="wishlist/create" options={{ presentation: 'modal', headerShown: false }} />
              <Stack.Screen name="invite/[token]" options={{ headerShown: false }} />
            </Stack>
          </AuthGate>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
