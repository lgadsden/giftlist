import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/Colors';

export type ActionSheetItem = {
  key: string;
  label: string;
  subtitle?: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  destructive?: boolean;
  testID?: string;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title?: string;
  onClose: () => void;
  items: ActionSheetItem[];
};

export function ActionSheet({ visible, title, onClose, items }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel="Close menu" />
        <View style={styles.sheet} testID="action-sheet">
          <View style={styles.handle} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {items.map((item, index) => (
            <View key={item.key}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <Pressable
                testID={item.testID}
                onPress={() => {
                  onClose();
                  // Let the sheet close before running the action
                  requestAnimationFrame(() => item.onPress());
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <View
                  style={[
                    styles.iconWrap,
                    item.destructive && styles.iconWrapDanger,
                  ]}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={22}
                    color={item.destructive ? theme.colors.danger : theme.colors.ink}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, item.destructive && styles.labelDanger]}>
                    {item.label}
                  </Text>
                  {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
                </View>
                {!item.destructive ? (
                  <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.line} />
                ) : null}
              </Pressable>
            </View>
          ))}
          <Pressable onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(26,26,31,0.4)',
  },
  dismiss: { flex: 1 },
  sheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 8,
    ...theme.shadow.card,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.line,
    marginBottom: 10,
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  rowPressed: { backgroundColor: theme.colors.background },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDanger: { backgroundColor: '#FDECEC' },
  label: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: theme.colors.ink,
  },
  labelDanger: { color: theme.colors.danger },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.line,
    marginLeft: 54,
  },
  cancel: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: theme.colors.muted,
  },
});
