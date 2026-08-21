import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, Field, Muted } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';

export type DraftGift = {
  title: string;
  url: string | null;
  imageUrl: string | null;
  price: number | null;
  notes: string;
};

type Phase = 'url' | 'loading' | 'edit';

type Props = {
  visible: boolean;
  listTitle: string;
  onClose: () => void;
  onSave: (draft: DraftGift) => Promise<void>;
};

function formatPriceInput(price: number | null): string {
  if (price == null) return '';
  return String(price);
}

function parsePriceInput(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function AddGiftSheet({ visible, listTitle, onClose, onSave }: Props) {
  const [phase, setPhase] = useState<Phase>('url');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priceText, setPriceText] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPhase('url');
      setUrl('');
      setTitle('');
      setNotes('');
      setPriceText('');
      setImageUrl(null);
      setError(null);
      setSaving(false);
    }
  }, [visible]);

  const goManual = () => {
    setPhase('edit');
    setError(null);
  };

  const fetchFromUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Paste a product link, or enter details manually.');
      return;
    }
    let normalized = trimmed;
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;

    setPhase('loading');
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke<{
        title: string | null;
        imageUrl: string | null;
        description: string | null;
        price: number | null;
        error?: string;
      }>('unfurl', { body: { url: normalized } });

      if (fnError) throw fnError;

      setUrl(normalized);
      setTitle(data?.title?.trim() || '');
      setImageUrl(data?.imageUrl ?? null);
      setPriceText(formatPriceInput(data?.price ?? null));
      if (data?.description && !notes.trim()) setNotes(data.description.slice(0, 280));
      if (data?.error && !data.title && !data.imageUrl) {
        setError('Could not read that page — fill in the details below.');
      }
      setPhase('edit');
    } catch {
      setError('Could not fetch that link — enter details manually.');
      setPhase('edit');
    }
  };

  const save = async () => {
    if (!title.trim()) {
      setError('Product name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        url: url.trim() || null,
        imageUrl,
        price: parsePriceInput(priceText),
        notes: notes.trim(),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save gift');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet} testID="add-gift-sheet">
          <View style={styles.handle} />

          {phase === 'url' ? (
            <View style={styles.body}>
              <Text style={styles.heading}>Add gift</Text>
              <Muted>Paste a link to fetch name, photo, and price — or enter everything yourself.</Muted>
              <Field
                label="Product URL"
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                placeholder="https://…"
                testID="gift-url-input"
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button label="Fetch details" onPress={fetchFromUrl} testID="fetch-gift-button" />
              <Button label="Enter manually" variant="ghost" onPress={goManual} testID="manual-gift-button" />
              <Button label="Cancel" variant="ghost" onPress={onClose} />
            </View>
          ) : null}

          {phase === 'loading' ? (
            <View style={styles.loadingBody} testID="add-gift-loading">
              <View style={styles.loadingHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heading}>Adding gift…</Text>
                  <Muted>Fetching details from the link</Muted>
                </View>
                <ActivityIndicator color={theme.colors.pink} />
              </View>
              <View style={styles.skeletonCard}>
                <View style={styles.skeletonThumb} />
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={[styles.skeletonBar, { width: '80%' }]} />
                  <View style={[styles.skeletonBar, { width: '50%' }]} />
                </View>
              </View>
              <View style={styles.row}>
                <Button label="Cancel" variant="soft" onPress={onClose} />
              </View>
            </View>
          ) : null}

          {phase === 'edit' ? (
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <View style={styles.editHeader}>
                <Text style={styles.heading}>Add gift</Text>
                <Pressable onPress={onClose} hitSlop={12}>
                  <Text style={styles.close}>✕</Text>
                </Pressable>
              </View>

              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.hero}
                  accessibilityLabel="Gift preview image"
                  testID="gift-preview-image"
                />
              ) : (
                <View style={[styles.hero, styles.heroEmpty]}>
                  <Muted>No photo yet — you can still save the gift</Muted>
                </View>
              )}

              <Field
                label="Product name"
                value={title}
                onChangeText={setTitle}
                testID="gift-title-input"
              />
              <Muted>Save to · {listTitle}</Muted>
              <Field
                label="Price (optional)"
                value={priceText}
                onChangeText={setPriceText}
                keyboardType="decimal-pad"
                placeholder="0.00"
                testID="gift-price-input"
              />
              <Field
                label="Link (optional)"
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                placeholder="https://…"
                testID="gift-url-edit"
              />
              <Field
                label="Notes for gift"
                value={notes}
                onChangeText={setNotes}
                placeholder="Why this gift? Color, size…"
                multiline
                testID="gift-notes-input"
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button
                label="Add to list"
                onPress={save}
                loading={saving}
                testID="add-gift-button"
              />
              <Button label="Cancel" variant="ghost" onPress={onClose} />
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dismiss: { flex: 1 },
  sheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '92%',
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.line,
    marginTop: 10,
    marginBottom: 6,
  },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 12, paddingBottom: 16 },
  loadingBody: { paddingHorizontal: 20, paddingTop: 8, gap: 16, paddingBottom: 16 },
  loadingHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heading: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 22,
    color: theme.colors.ink,
  },
  close: { fontSize: 20, color: theme.colors.muted, padding: 4 },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  error: { color: theme.colors.danger, fontFamily: 'DMSans_500Medium', fontSize: 13 },
  hero: {
    width: '100%',
    height: 200,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.pinkSoft,
  },
  heroEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  skeletonCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  skeletonThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: theme.colors.pinkSoft,
  },
  skeletonBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.pinkSoft,
  },
  row: { flexDirection: 'row', gap: 10 },
});
