import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { AddGiftSheet, type DraftGift } from '@/components/AddGiftSheet';
import { Button, Card, Muted, Screen, Title } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/lib/auth';
import {
  DEFAULT_RESERVATION_VISIBILITY,
  eventTypeLabel,
  rewriteAffiliateUrl,
  type EventType,
  type ReservationVisibility,
} from '@/lib/domain';
import { supabase } from '@/lib/supabase';

type Wishlist = {
  id: string;
  title: string;
  event_type: EventType;
  event_date: string | null;
  owner_id: string;
};

type Gift = {
  id: string;
  title: string;
  notes: string | null;
  url: string | null;
  image_url: string | null;
  price: number | null;
  gift_type: string;
};

type Reservation = {
  gift_id: string;
  reserved_by: string | null;
  visibility: ReservationVisibility;
  status: string;
};

function formatPrice(price: number | null | undefined): string | null {
  if (price == null || Number.isNaN(Number(price))) return null;
  return `$${Number(price).toFixed(2)}`;
}

export default function WishlistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<Wishlist | null>(null);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [reservations, setReservations] = useState<Record<string, Reservation>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [reserveGift, setReserveGift] = useState<Gift | null>(null);
  const [visibility, setVisibility] = useState<ReservationVisibility>(DEFAULT_RESERVATION_VISIBILITY);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: list } = await supabase
      .from('wishlists')
      .select('id, title, event_type, event_date, owner_id')
      .eq('id', id)
      .maybeSingle();
    setWishlist((list as Wishlist | null) ?? null);

    const { data: giftRows } = await supabase
      .from('gifts')
      .select('id, title, notes, url, image_url, price, gift_type')
      .eq('wishlist_id', id)
      .order('created_at', { ascending: false });
    const nextGifts = (giftRows as Gift[]) ?? [];
    setGifts(nextGifts);

    if (nextGifts.length) {
      const { data: resRows } = await supabase
        .from('reservations_public')
        .select('gift_id, reserved_by, visibility, status')
        .in(
          'gift_id',
          nextGifts.map((g) => g.id),
        );
      const map: Record<string, Reservation> = {};
      for (const r of (resRows as Reservation[]) ?? []) map[r.gift_id] = r;
      setReservations(map);
    } else {
      setReservations({});
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const isOwner = wishlist?.owner_id === user?.id;

  const saveGift = async (draft: DraftGift) => {
    if (!id) throw new Error('Missing wishlist');
    const { error } = await supabase.from('gifts').insert({
      wishlist_id: id,
      title: draft.title,
      url: draft.url,
      image_url: draft.imageUrl,
      price: draft.price,
      notes: draft.notes || null,
      gift_type: draft.url ? 'item' : 'other',
    });
    if (error) throw new Error(error.message);
    await load();
  };

  const removeGift = async (gift: Gift) => {
    const { error } = await supabase.from('gifts').delete().eq('id', gift.id);
    if (error) Alert.alert('Could not remove gift', error.message);
    await load();
  };

  const shop = async (gift: Gift) => {
    if (!gift.url || !user) return;
    const { data: merchants } = await supabase
      .from('affiliate_merchants')
      .select('id, host_patterns, tag_param, tag_value, enabled');

    const rewritten = rewriteAffiliateUrl(
      gift.url,
      ((merchants as {
        id: string;
        host_patterns: string[];
        tag_param: string | null;
        tag_value: string | null;
        enabled: boolean;
      }[]) ?? []).map((m) => ({
        id: m.id,
        hostPatterns: m.host_patterns,
        tagParam: m.tag_param,
        tagValue: m.tag_value,
        enabled: m.enabled,
      })),
    );

    await supabase.from('affiliate_clicks').insert({
      gift_id: gift.id,
      user_id: user.id,
      destination_url: rewritten.url,
      merchant_id: rewritten.merchantId,
      tagged: rewritten.tagged,
    });

    await Linking.openURL(rewritten.url);
  };

  const confirmReserve = async () => {
    if (!reserveGift || !user) return;
    const { error } = await supabase.from('reservations').insert({
      gift_id: reserveGift.id,
      reserved_by: user.id,
      visibility,
      status: 'reserved',
    });
    if (error) Alert.alert('Could not reserve', error.message);
    setReserveGift(null);
    setVisibility(DEFAULT_RESERVATION_VISIBILITY);
    await load();
  };

  const totalValue = gifts.reduce((sum, g) => sum + (Number(g.price) || 0), 0);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }>
        <Title>{wishlist?.title ?? 'Wishlist'}</Title>
        <Muted>
          {wishlist
            ? `${gifts.length} item${gifts.length === 1 ? '' : 's'}${
                totalValue > 0 ? ` · $${totalValue.toFixed(2)}` : ''
              } · ${eventTypeLabel(wishlist.event_type)}${
                wishlist.event_date ? ` · ${wishlist.event_date}` : ''
              }`
            : 'Loading…'}
        </Muted>

        {gifts.map((gift) => {
          const res = reservations[gift.id];
          const reserved = Boolean(res && res.status !== 'cancelled');
          const priceLabel = formatPrice(gift.price);
          return (
            <Card
              key={gift.id}
              style={[styles.giftRow, reserved && { opacity: 0.7 }]}
              testID={`gift-row-${gift.id}`}>
              {gift.image_url ? (
                <Image source={{ uri: gift.image_url }} style={styles.thumb} accessibilityLabel="" />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]} />
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.giftTitle} testID={`gift-title-${gift.title}`}>
                  {gift.title}
                </Text>
                {priceLabel ? <Text style={styles.price}>{priceLabel}</Text> : null}
                <Muted>
                  {gift.gift_type === 'experience' ? 'Experience' : gift.url ? 'Item' : 'Custom'}
                  {reserved ? ' · Reserved' : ''}
                </Muted>
              </View>
              {!reserved && gift.url ? (
                <Pressable onPress={() => shop(gift)}>
                  <Text style={styles.shop}>Shop</Text>
                </Pressable>
              ) : null}
              {!reserved && !isOwner ? (
                <Button label="Reserve" variant="soft" onPress={() => setReserveGift(gift)} />
              ) : null}
              {reserved ? (
                <View style={styles.reservedPill}>
                  <Text style={styles.reservedText}>Reserved</Text>
                </View>
              ) : null}
              {isOwner ? (
                <Pressable
                  accessibilityLabel={`Remove ${gift.title}`}
                  testID={`remove-gift-${gift.title}`}
                  onPress={() => removeGift(gift)}
                  style={styles.removeBtn}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              ) : null}
            </Card>
          );
        })}

        {gifts.length === 0 ? (
          <Card>
            <Muted>
              {isOwner ? 'Tap + to add your first gift from a link or manually.' : 'No gifts on this list yet.'}
            </Muted>
          </Card>
        ) : null}
      </ScrollView>

      {isOwner ? (
        <Pressable
          accessibilityLabel="Add gift"
          testID="open-add-gift"
          onPress={() => setAddOpen(true)}
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}>
          <Text style={styles.fabPlus}>+</Text>
        </Pressable>
      ) : null}

      <AddGiftSheet
        visible={addOpen}
        listTitle={wishlist?.title ?? 'Wishlist'}
        onClose={() => setAddOpen(false)}
        onSave={saveGift}
      />

      <Modal visible={Boolean(reserveGift)} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Reserve this gift</Text>
            <Muted>{reserveGift?.title ?? ''}</Muted>
            <Pressable
              style={[styles.option, visibility === 'secret' && styles.optionOn]}
              onPress={() => setVisibility('secret')}>
              <Text style={styles.optionTitle}>Secret</Text>
              <Muted>They won't see who reserved it</Muted>
            </Pressable>
            <Pressable
              style={[styles.option, visibility === 'notify' && styles.optionOn]}
              onPress={() => setVisibility('notify')}>
              <Text style={styles.optionTitle}>Notify them</Text>
              <Muted>They'll get an in-app update</Muted>
            </Pressable>
            <Button label="Reserve gift" onPress={confirmReserve} />
            <Button
              label="Cancel"
              variant="ghost"
              onPress={() => {
                setReserveGift(null);
                setVisibility(DEFAULT_RESERVATION_VISIBILITY);
              }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  giftRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  giftTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: theme.colors.ink,
  },
  price: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: theme.colors.pink,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: theme.colors.pinkSoft,
  },
  thumbEmpty: { borderWidth: 1, borderColor: theme.colors.line },
  shop: {
    fontFamily: 'DMSans_700Bold',
    color: theme.colors.sage,
    paddingHorizontal: 8,
  },
  removeBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  removeText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    color: theme.colors.pink,
  },
  reservedPill: {
    backgroundColor: theme.colors.pinkSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  reservedText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    color: theme.colors.pink,
  },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 24,
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
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
  },
  sheetTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 22,
    color: theme.colors.sage,
  },
  option: {
    borderWidth: 1.5,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    padding: 14,
    gap: 4,
  },
  optionOn: {
    borderColor: theme.colors.sage,
    backgroundColor: '#E8F0EC',
  },
  optionTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: theme.colors.ink,
  },
});
