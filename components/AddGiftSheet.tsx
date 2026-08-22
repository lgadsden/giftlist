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
import {
  formatPriceInput,
  GIFT_PRIORITIES,
  normalizeGiftPriority,
  parsePriceInput,
  type GiftPriority,
} from '@/lib/gifts';
import { retailerLabel, urlNeedsBrowser } from '@/lib/retailers';
import { cleanScrapedTitle, shortProductTitle } from '@/lib/productTitle';
import { supabase } from '@/lib/supabase';

export type DraftGift = {
  title: string;
  url: string | null;
  imageUrl: string | null;
  price: number | null;
  notes: string;
  priority: GiftPriority;
};

export type EditableGift = DraftGift & { id: string };

type Phase = 'url' | 'loading' | 'edit';

type Props = {
  visible: boolean;
  listTitle: string;
  onClose: () => void;
  onSave: (draft: DraftGift) => Promise<void>;
  /** When set, opens directly in edit mode for an existing gift. */
  initialGift?: EditableGift | null;
};

export function AddGiftSheet({ visible, listTitle, onClose, onSave, initialGift }: Props) {
  const editing = Boolean(initialGift);
  const [phase, setPhase] = useState<Phase>(editing ? 'edit' : 'url');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priceText, setPriceText] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [priority, setPriority] = useState<GiftPriority>(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingHint, setLoadingHint] = useState('Fetching details from the link');
  const [photoOpen, setPhotoOpen] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPhase('url');
      setUrl('');
      setTitle('');
      setNotes('');
      setPriceText('');
      setImageUrl(null);
      setPriority(0);
      setError(null);
      setSaving(false);
      setLoadingHint('Fetching details from the link');
      setPhotoOpen(false);
      return;
    }
    if (initialGift) {
      setPhase('edit');
      setUrl(initialGift.url ?? '');
      setTitle(initialGift.title);
      setNotes(initialGift.notes ?? '');
      setPriceText(formatPriceInput(initialGift.price));
      setImageUrl(initialGift.imageUrl);
      setPriority(normalizeGiftPriority(initialGift.priority));
      setError(null);
    }
  }, [visible, initialGift]);

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

    const retailer = retailerLabel(normalized);
    const slowPath = urlNeedsBrowser(normalized);
    setLoadingHint(
      slowPath
        ? `Fetching from ${retailer ?? 'store'}… this can take a few seconds`
        : 'Fetching details from the link',
    );
    setPhase('loading');
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke<{
        title: string | null;
        imageUrl: string | null;
        description: string | null;
        price: number | null;
        mode?: 'fast' | 'browser';
        usedBrowser?: boolean;
        error?: string;
      }>('unfurl', { body: { url: normalized } });

      if (fnError) throw fnError;

      setUrl(normalized);
      setTitle(cleanScrapedTitle(data?.title) || '');
      setImageUrl(data?.imageUrl ?? null);
      setPriceText(formatPriceInput(data?.price ?? null));
      if (data?.description && !notes.trim()) setNotes(data.description.slice(0, 280));
      if (data?.error && !data.title && !data.imageUrl) {
        setError(data.error);
      } else if (data?.error) {
        setError(data.error);
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
        priority,
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
        <View style={styles.sheet} testID={editing ? 'edit-gift-sheet' : 'add-gift-sheet'}>
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
                  <Muted>{loadingHint}</Muted>
                </View>
                <ActivityIndicator color={theme.colors.pink} size="large" />
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
                <Text style={styles.heading}>{editing ? 'Edit gift' : 'Add gift'}</Text>
                <Pressable onPress={onClose} hitSlop={12}>
                  <Text style={styles.close}>✕</Text>
                </Pressable>
              </View>

              {imageUrl ? (
                <Pressable
                  onPress={() => setPhotoOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="View larger photo"
                  testID="gift-preview-thumb"
                  style={styles.thumbRow}>
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.thumb}
                    resizeMode="contain"
                    accessibilityLabel="Gift preview image"
                    testID="gift-preview-image"
                  />
                  <Muted>Tap to enlarge</Muted>
                </Pressable>
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Muted>No photo yet</Muted>
                </View>
              )}

              <Field
                label="Product name"
                value={title}
                onChangeText={setTitle}
                testID="gift-title-input"
              />
              {title.trim() ? (
                <Muted>List will show · {shortProductTitle(title) || title.trim()}</Muted>
              ) : null}
              <Muted>Save to · {listTitle}</Muted>
              <Field
                label="Price (optional)"
                value={priceText}
                onChangeText={setPriceText}
                keyboardType="decimal-pad"
                placeholder="0.00"
                testID="gift-price-input"
              />
              <Text style={styles.priorityLabel}>Priority</Text>
              <View style={styles.priorityRow} testID="gift-priority-picker">
                {GIFT_PRIORITIES.map((opt) => {
                  const on = priority === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setPriority(opt.value)}
                      testID={`gift-priority-${opt.label.toLowerCase()}`}
                      style={[styles.priorityChip, on && styles.priorityChipOn]}>
                      <Text style={[styles.priorityChipText, on && styles.priorityChipTextOn]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
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
                label={editing ? 'Save changes' : 'Add to list'}
                onPress={save}
                loading={saving}
                testID={editing ? 'save-gift-button' : 'add-gift-button'}
              />
              <Button label="Cancel" variant="ghost" onPress={onClose} />
            </ScrollView>
          ) : null}
        </View>
      </View>

      <Modal
        visible={photoOpen && Boolean(imageUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoOpen(false)}>
        <Pressable
          style={styles.lightbox}
          onPress={() => setPhotoOpen(false)}
          accessibilityLabel="Close photo"
          testID="gift-photo-lightbox">
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.lightboxImage}
              resizeMode="contain"
              testID="gift-preview-full"
            />
          ) : null}
          <Text style={styles.lightboxHint}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>
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
  thumbRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 14,
    backgroundColor: theme.colors.pinkSoft,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  lightboxImage: {
    width: '100%',
    height: '75%',
  },
  lightboxHint: {
    marginTop: 16,
    color: '#fff',
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
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
  priorityLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: theme.colors.ink,
  },
  priorityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priorityChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.white,
  },
  priorityChipOn: {
    borderColor: theme.colors.pink,
    backgroundColor: theme.colors.pinkSoft,
  },
  priorityChipText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: theme.colors.muted,
  },
  priorityChipTextOn: {
    fontFamily: 'DMSans_700Bold',
    color: theme.colors.pink,
  },
});
