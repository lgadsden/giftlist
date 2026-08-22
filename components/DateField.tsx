import DateTimePicker from '@react-native-community/datetimepicker';
import { createElement, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { theme } from '@/constants/Colors';
import {
  formatUsDate,
  maskUsDateInput,
  parseIsoDate,
  parseUsDateInput,
  toIsoDate,
} from '@/lib/dates';

type Props = {
  label?: string;
  /** ISO YYYY-MM-DD or empty string */
  value: string;
  onChange: (isoDate: string) => void;
  testID?: string;
};

/**
 * US date entry (MM-DD-YYYY) with a system / browser date picker.
 * - iOS & Android: native DateTimePicker
 * - Web: browser `<input type="date">` picker
 */
export function DateField({
  label = 'Date (optional)',
  value,
  onChange,
  testID,
}: Props) {
  const [text, setText] = useState(formatUsDate(value || null));
  const [open, setOpen] = useState(false);
  const webInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setText(formatUsDate(value || null));
  }, [value]);

  const applyIso = (iso: string) => {
    onChange(iso);
    setText(formatUsDate(iso || null));
  };

  const onTextChange = (raw: string) => {
    const masked = maskUsDateInput(raw);
    setText(masked);
    if (!masked) {
      onChange('');
      return;
    }
    const iso = parseUsDateInput(masked);
    if (iso) onChange(iso);
    else if (masked.length >= 10) onChange('');
  };

  const openPicker = () => {
    if (Platform.OS === 'web') {
      webInputRef.current?.showPicker?.();
      webInputRef.current?.focus();
      webInputRef.current?.click();
      return;
    }
    setOpen(true);
  };

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          accessibilityLabel={label}
          testID={testID}
          value={text}
          onChangeText={onTextChange}
          placeholder="MM-DD-YYYY"
          placeholderTextColor={theme.colors.muted}
          keyboardType="number-pad"
          autoCapitalize="none"
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick a date"
          testID={testID ? `${testID}-picker` : 'date-picker-button'}
          onPress={openPicker}
          style={({ pressed }) => [styles.pickBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.pickLabel}>Pick</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Example 12-25-2026 · or tap Pick</Text>

      {Platform.OS === 'web'
        ? createElement('input', {
            ref: webInputRef,
            type: 'date',
            value: value || '',
            onChange: (e: { target: { value: string } }) => {
              applyIso(e.target.value || '');
            },
            style: {
              position: 'absolute',
              opacity: 0,
              width: 1,
              height: 1,
              pointerEvents: 'none',
            },
            'aria-hidden': true,
            tabIndex: -1,
          })
        : null}

      {open && Platform.OS !== 'web' ? (
        <DateTimePicker
          value={parseIsoDate(value) ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            if (Platform.OS === 'android') setOpen(false);
            if (event.type === 'dismissed') {
              setOpen(false);
              return;
            }
            if (date) applyIso(toIsoDate(date));
          }}
        />
      ) : null}

      {open && Platform.OS === 'ios' ? (
        <Pressable onPress={() => setOpen(false)} style={styles.done}>
          <Text style={styles.doneLabel}>Done</Text>
        </Pressable>
      ) : null}
    </View>
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
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderWidth: 1.5,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    color: theme.colors.ink,
  },
  pickBtn: {
    backgroundColor: theme.colors.sage,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  pickLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: '#fff',
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: theme.colors.muted,
  },
  done: { alignSelf: 'flex-end', paddingVertical: 6 },
  doneLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: theme.colors.pink,
  },
});
