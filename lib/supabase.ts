import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Metro / Expo Go host (e.g. `192.168.1.12:8081`) — used so a physical phone can hit local Supabase. */
function getDevMachineHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    null;
  if (!hostUri) return null;
  const host = hostUri.split(':')[0]?.trim();
  if (!host || host === '127.0.0.1' || host === 'localhost') return null;
  return host;
}

function resolveSupabaseUrl(raw: string): string {
  if (!raw) return 'http://127.0.0.1:54321';
  if (Platform.OS === 'web') return raw;

  const loopback = raw.match(/^(https?):\/\/(127\.0\.0\.1|localhost)(:\d+)?/i);
  if (!loopback) return raw;

  const port = loopback[3] ?? '';
  const scheme = loopback[1];

  // Physical device: rewrite loopback → Mac LAN IP from Expo's connection host
  const lanHost = getDevMachineHost();
  if (lanHost) {
    return `${scheme}://${lanHost}${port}${raw.slice(loopback[0].length)}`;
  }

  // Android emulator reaches the host machine via 10.0.2.2
  if (Platform.OS === 'android') {
    return raw
      .replace('http://127.0.0.1', 'http://10.0.2.2')
      .replace('http://localhost', 'http://10.0.2.2')
      .replace('https://127.0.0.1', 'https://10.0.2.2')
      .replace('https://localhost', 'https://10.0.2.2');
  }

  // iOS Simulator can use 127.0.0.1 as-is
  return raw;
}

const supabaseUrl = resolveSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '');
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const storage =
  Platform.OS === 'web'
    ? {
        getItem: (key: string) => {
          if (typeof localStorage === 'undefined') return Promise.resolve(null);
          return Promise.resolve(localStorage.getItem(key));
        },
        setItem: (key: string, value: string) => {
          if (typeof localStorage === 'undefined') return Promise.resolve();
          localStorage.setItem(key, value);
          return Promise.resolve();
        },
        removeItem: (key: string) => {
          if (typeof localStorage === 'undefined') return Promise.resolve();
          localStorage.removeItem(key);
          return Promise.resolve();
        },
      }
    : AsyncStorage;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || 'http://127.0.0.1:54321',
  supabaseAnonKey || 'public-anon-key',
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  },
);
