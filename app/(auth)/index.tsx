import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Brand, Button, Field, Muted, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

function safeNextPath(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export default function AuthScreen() {
  const { session, loading } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const nextPath = safeNextPath(next);
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && session) {
    return <Redirect href={(nextPath ?? '/(tabs)') as '/(tabs)'} />;
  }

  const afterAuth = () => {
    router.replace((nextPath ?? '/(tabs)') as '/(tabs)');
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const username = displayName
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '')
          .slice(0, 30);
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName || email.split('@')[0],
              username: username.length >= 3 ? username : undefined,
            },
          },
        });
        if (error) throw error;
        Alert.alert(
          'Account created',
          'Local Supabase usually auto-confirms email. You can sign in now.',
        );
      }
      afterAuth();
    } catch (e) {
      Alert.alert('Auth error', e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.wrap}>
        <Brand />
        <View style={{ gap: 4, marginTop: 18 }}>
          <Title>{mode === 'signin' ? 'Welcome back' : 'Create account'}</Title>
          <Muted>
            {nextPath
              ? 'Sign in to finish accepting your invite.'
              : 'Wishlists for friends, groups, and every occasion.'}
          </Muted>
        </View>
        <View style={{ gap: 12, marginTop: 24 }}>
          {mode === 'signup' ? (
            <Field
              label="Display name"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              testID="auth-display-name"
            />
          ) : null}
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            testID="auth-email"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'signin' ? 'password' : 'new-password'}
            testID="auth-password"
          />
          <Button
            label={mode === 'signin' ? 'Sign in' : 'Sign up'}
            onPress={submit}
            loading={busy}
            testID="auth-submit"
          />
          <Button
            label={mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
            variant="ghost"
            onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            testID="auth-toggle-mode"
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 40,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
});
