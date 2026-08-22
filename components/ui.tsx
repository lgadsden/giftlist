import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/Colors';

export function Screen({ style, ...props }: ViewProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={[styles.screen, style]} {...props} />
    </SafeAreaView>
  );
}

export function Title({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Brand({ children = 'Giftlist' }: { children?: string }) {
  return <Text style={styles.brand}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  testID,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'soft' | 'ghost' | 'sage';
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'soft' && styles.btnSoft,
        variant === 'ghost' && styles.btnGhost,
        variant === 'sage' && styles.btnSage,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'soft' || variant === 'ghost' ? theme.colors.pink : '#fff'} />
      ) : (
        <Text
          style={[
            styles.btnLabel,
            (variant === 'soft' || variant === 'ghost') && { color: theme.colors.pink },
            variant === 'sage' && { color: '#fff' },
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.muted}
        style={[styles.input, rest.multiline && styles.inputMultiline, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  brand: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 28,
    color: theme.colors.sage,
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 24,
    color: theme.colors.ink,
    letterSpacing: -0.3,
  },
  muted: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: theme.colors.muted,
    lineHeight: 20,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(26,26,31,0.05)',
    padding: 14,
    ...theme.shadow.card,
  },
  btn: {
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnPrimary: {
    backgroundColor: theme.colors.pink,
    shadowColor: theme.colors.pink,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  btnSoft: { backgroundColor: theme.colors.pinkSoft },
  btnGhost: {
    backgroundColor: theme.colors.white,
    borderWidth: 1.5,
    borderColor: theme.colors.line,
  },
  btnSage: { backgroundColor: theme.colors.sage },
  btnLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: '#fff',
  },
  fieldLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
  input: {
    backgroundColor: theme.colors.white,
    borderWidth: 1.5,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    color: theme.colors.ink,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
});
