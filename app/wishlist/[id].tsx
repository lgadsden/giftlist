import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ActionSheet, type ActionSheetItem } from '@/components/ActionSheet';
import { AddGiftSheet, type DraftGift, type EditableGift } from '@/components/AddGiftSheet';
import { Button, Card, Muted, Screen } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/lib/auth';
import {
  DEFAULT_RESERVATION_VISIBILITY,
  eventTypeLabel,
  rewriteAffiliateUrl,
  type EventType,
  type ReservationVisibility,
} from '@/lib/domain';
import { formatWishlistDate } from '@/lib/eventCovers';
import {
  compareGiftsByPriority,
  giftPriorityLabel,
  giftPriorityTone,
  normalizeGiftPriority,
  type GiftPriority,
} from '@/lib/gifts';
import { loadLikedGiftIds, toggleLikedGift } from '@/lib/likes';
import { shortProductTitle } from '@/lib/productTitle';
import { canMarkPurchased, canUndoClaim, reservationBadge } from '@/lib/reservations';
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
  priority: GiftPriority;
  created_at?: string;
};

type Reservation = {
  id?: string;
  gift_id: string;
  reserved_by: string | null;
  visibility: ReservationVisibility;
  status: string;
};

type GiftFilter = 'all' | 'available';

function formatPrice(price: number | null | undefined): string | null {
  if (price == null || Number.isNaN(Number(price))) return null;
  return `$${Number(price).toFixed(2)}`;
}

function toEditable(gift: Gift): EditableGift {
  return {
    id: gift.id,
    title: gift.title,
    url: gift.url,
    imageUrl: gift.image_url,
    price: gift.price,
    notes: gift.notes ?? '',
    priority: normalizeGiftPriority(gift.priority),
  };
}

function GiftThumb({ uri, dimmed }: { uri: string | null; dimmed?: boolean }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.thumb, dimmed && styles.thumbDim]}
        resizeMode="cover"
        accessibilityLabel=""
      />
    );
  }
  return (
    <View style={[styles.thumb, styles.thumbEmpty]}>
      <MaterialCommunityIcons name="gift-outline" size={28} color={theme.colors.muted} />
    </View>
  );
}

export default function WishlistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<Wishlist | null>(null);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [reservations, setReservations] = useState<Record<string, Reservation>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editGift, setEditGift] = useState<EditableGift | null>(null);
  const [reserveGift, setReserveGift] = useState<Gift | null>(null);
  const [visibility, setVisibility] = useState<ReservationVisibility>(DEFAULT_RESERVATION_VISIBILITY);
  const [menuGift, setMenuGift] = useState<Gift | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<GiftFilter>('all');
  const [ownerName, setOwnerName] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: list } = await supabase
      .from('wishlists')
      .select('id, title, event_type, event_date, owner_id')
      .eq('id', id)
      .maybeSingle();
    const nextList = (list as Wishlist | null) ?? null;
    setWishlist(nextList);

    if (nextList && nextList.owner_id !== user?.id) {
      const { data: owner } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', nextList.owner_id)
        .maybeSingle();
      setOwnerName((owner as { display_name?: string } | null)?.display_name ?? null);
    } else {
      setOwnerName(null);
    }

    const { data: giftRows } = await supabase
      .from('gifts')
      .select('id, title, notes, url, image_url, price, gift_type, priority, created_at')
      .eq('wishlist_id', id)
      .order('created_at', { ascending: false });
    const nextGifts = ((giftRows as Gift[]) ?? [])
      .map((g) => ({ ...g, priority: normalizeGiftPriority(g.priority) }))
      .sort(compareGiftsByPriority);
    setGifts(nextGifts);

    if (nextGifts.length) {
      const { data: resRows } = await supabase
        .from('reservations_public')
        .select('id, gift_id, reserved_by, visibility, status')
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
  }, [id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!user?.id) return;
    void loadLikedGiftIds(user.id).then(setLikedIds);
  }, [user?.id]);

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
      priority: draft.priority,
    });
    if (error) throw new Error(error.message);
    await load();
  };

  const updateGift = async (draft: DraftGift) => {
    if (!editGift) throw new Error('Missing gift');
    const { error } = await supabase
      .from('gifts')
      .update({
        title: draft.title,
        url: draft.url,
        image_url: draft.imageUrl,
        price: draft.price,
        notes: draft.notes || null,
        gift_type: draft.url ? 'item' : 'other',
        priority: draft.priority,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editGift.id);
    if (error) throw new Error(error.message);
    await load();
  };

  const removeGift = async (gift: Gift) => {
    const { error } = await supabase.from('gifts').delete().eq('id', gift.id);
    if (error) Alert.alert('Could not remove gift', error.message);
    await load();
  };

  const confirmRemove = (gift: Gift) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Delete “${gift.title}”?`)) {
        void removeGift(gift);
      }
      return;
    }
    Alert.alert('Delete item', `Permanently remove “${gift.title}” from this list?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void removeGift(gift) },
    ]);
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
    if (error) Alert.alert('Could not claim gift', error.message);
    setReserveGift(null);
    setVisibility(DEFAULT_RESERVATION_VISIBILITY);
    await load();
  };

  const markPurchased = async (giftId: string) => {
    const res = reservations[giftId];
    if (!res?.id) return;
    const { error } = await supabase
      .from('reservations')
      .update({ status: 'purchased', updated_at: new Date().toISOString() })
      .eq('id', res.id);
    if (error) Alert.alert('Could not update', error.message);
    await load();
  };

  const undoClaim = async (giftId: string) => {
    const res = reservations[giftId];
    if (!res?.id) return;
    const { error } = await supabase.from('reservations').delete().eq('id', res.id);
    if (error) Alert.alert('Could not release claim', error.message);
    await load();
  };

  const onToggleLike = async (giftId: string) => {
    if (!user?.id) return;
    const next = await toggleLikedGift(user.id, giftId);
    setLikedIds(next);
  };

  const menuItems = (gift: Gift): ActionSheetItem[] => {
    const items: ActionSheetItem[] = [];
    if (isOwner) {
      items.push({
        key: 'edit',
        label: 'Edit item details',
        subtitle: 'Update name, price, or priority',
        icon: 'pencil-outline',
        testID: 'gift-menu-edit',
        onPress: () => setEditGift(toEditable(gift)),
      });
    }
    if (gift.url) {
      items.push({
        key: 'shop',
        label: 'Shop this gift',
        subtitle: 'Open the store link',
        icon: 'shopping-outline',
        testID: 'gift-menu-shop',
        onPress: () => void shop(gift),
      });
    }
    if (isOwner) {
      items.push({
        key: 'delete',
        label: 'Delete item',
        subtitle: 'Permanently remove from wishlist',
        icon: 'trash-can-outline',
        destructive: true,
        testID: 'gift-menu-delete',
        onPress: () => confirmRemove(gift),
      });
    }
    return items;
  };

  const purchasedCount = gifts.filter((g) => reservations[g.id]?.status === 'purchased').length;
  const totalValue = gifts.reduce((sum, g) => sum + (Number(g.price) || 0), 0);

  const visibleGifts = gifts.filter((gift) => {
    if (filter === 'all') return true;
    const res = reservations[gift.id];
    return !(res && res.status !== 'cancelled');
  });

  const renderGiftCard = (gift: Gift) => {
    const res = reservations[gift.id];
    const active = Boolean(res && res.status !== 'cancelled');
    const isReserver = Boolean(user && res?.reserved_by === user.id);
    const badge = active
      ? reservationBadge({
          status: res!.status,
          isOwner: Boolean(isOwner),
          isReserver,
        })
      : { label: '', tone: 'none' as const };
    const priceLabel = formatPrice(gift.price);
    const liked = likedIds.has(gift.id);
    const displayTitle = shortProductTitle(gift.title) || gift.title;
    const priorityLabel = giftPriorityLabel(gift.priority);
    const priorityTone = giftPriorityTone(gift.priority);

    const card = (
      <Card
        style={[
          styles.giftCard,
          active && !isReserver && styles.giftCardDim,
          isReserver && styles.giftCardYours,
        ]}
        testID={`gift-row-${gift.id}`}>
        <View style={styles.giftBody}>
          <GiftThumb uri={gift.image_url} dimmed={active && !isReserver} />
          <View style={styles.giftCopy}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.giftTitle, active && !isReserver && styles.giftTitleStruck]}
                numberOfLines={2}
                testID={`gift-title-${gift.title}`}>
                {displayTitle}
              </Text>
              <View style={styles.iconActions}>
                <Pressable
                  onPress={() => void onToggleLike(gift.id)}
                  hitSlop={8}
                  accessibilityLabel={liked ? 'Unlike gift' : 'Like gift'}
                  testID={`like-gift-${gift.title}`}
                  style={styles.iconBtn}>
                  <MaterialCommunityIcons
                    name={liked ? 'heart' : 'heart-outline'}
                    size={22}
                    color={liked ? theme.colors.pink : theme.colors.muted}
                  />
                </Pressable>
                {(isOwner || gift.url) && (
                  <Pressable
                    onPress={() => setMenuGift(gift)}
                    hitSlop={8}
                    accessibilityLabel={`Options for ${gift.title}`}
                    testID={`gift-menu-${gift.title}`}
                    style={styles.iconBtn}>
                    <MaterialCommunityIcons name="dots-vertical" size={22} color={theme.colors.muted} />
                  </Pressable>
                )}
              </View>
            </View>
            {gift.notes ? (
              <Text style={styles.notes} numberOfLines={2}>
                {gift.notes}
              </Text>
            ) : null}
            <View style={styles.metaInline}>
              {priceLabel ? (
                <Text
                  style={[styles.price, active && !isReserver && styles.priceStruck]}
                  testID={`gift-price-${gift.title}`}>
                  {priceLabel}
                </Text>
              ) : null}
              {priorityLabel ? (
                <View
                  style={[
                    styles.priorityChip,
                    priorityTone === 'high' && styles.priorityHigh,
                    priorityTone === 'medium' && styles.priorityMedium,
                    priorityTone === 'low' && styles.priorityLow,
                  ]}
                  testID={`gift-priority-${gift.title}`}>
                  <Text
                    style={[
                      styles.priorityChipText,
                      priorityTone === 'high' && styles.priorityHighText,
                      priorityTone === 'medium' && styles.priorityMediumText,
                      priorityTone === 'low' && styles.priorityLowText,
                    ]}>
                    {priorityLabel}
                  </Text>
                </View>
              ) : null}
              {badge.label ? (
                <View
                  style={[
                    styles.statusChip,
                    badge.tone === 'purchased' && styles.purchasedPill,
                    badge.tone === 'yours' && styles.yoursPill,
                  ]}
                  testID={`gift-status-${gift.title}`}>
                  <Text style={styles.statusChipText}>{badge.label}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {!isOwner && !active ? (
          <Pressable
            style={styles.claimBtn}
            onPress={() => setReserveGift(gift)}
            testID={`claim-gift-${gift.title}`}>
            <MaterialCommunityIcons name="gift-outline" size={18} color="#fff" />
            <Text style={styles.claimBtnText}>Claim gift</Text>
          </Pressable>
        ) : null}

        {active && !isReserver ? (
          <View style={styles.claimedBar}>
            <MaterialCommunityIcons name="lock-outline" size={18} color={theme.colors.muted} />
            <Text style={styles.claimedBarText}>Claimed</Text>
          </View>
        ) : null}

        {isReserver && canMarkPurchased({ status: res!.status, isReserver }) ? (
          <Pressable
            style={styles.purchasedBtn}
            onPress={() => markPurchased(gift.id)}
            testID={`mark-purchased-${gift.title}`}>
            <MaterialCommunityIcons name="check-circle-outline" size={18} color={theme.colors.sage} />
            <Text style={styles.purchasedBtnText}>Mark purchased</Text>
          </Pressable>
        ) : null}

        {isReserver && res!.status === 'purchased' ? (
          <Pressable
            style={styles.purchasedBtn}
            onPress={() => undoClaim(gift.id)}
            testID={`undo-claim-${gift.title}`}>
            <MaterialCommunityIcons name="check-circle" size={18} color={theme.colors.sage} />
            <Text style={styles.purchasedBtnText}>
              Marked purchased <Text style={styles.undoHint}>(Undo)</Text>
            </Text>
          </Pressable>
        ) : null}

        {isReserver && canUndoClaim({ status: res!.status, isReserver }) && res!.status !== 'purchased' ? (
          <Pressable onPress={() => undoClaim(gift.id)} testID={`undo-claim-${gift.title}`}>
            <Text style={styles.releaseLink}>Release claim</Text>
          </Pressable>
        ) : null}
      </Card>
    );

    return <View key={gift.id}>{card}</View>;
  };

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
        <Text style={styles.listHeading}>{wishlist?.title ?? 'Wishlist'}</Text>
        {!isOwner && ownerName ? (
          <Text style={styles.ownerLine}>{ownerName}&apos;s wishlist</Text>
        ) : null}
        <Text style={styles.listSummary}>
          {wishlist
            ? `${gifts.length} item${gifts.length === 1 ? '' : 's'}${
                purchasedCount > 0 ? `  ·  ${purchasedCount} purchased` : ''
              }${totalValue > 0 ? `  ·  $${totalValue.toFixed(2)}` : ''}`
            : 'Loading…'}
        </Text>
        {wishlist ? (
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{eventTypeLabel(wishlist.event_type)}</Text>
            </View>
            {wishlist.event_date ? (
              <Text style={styles.metaDate}>{formatWishlistDate(wishlist.event_date)}</Text>
            ) : null}
          </View>
        ) : null}

        {!isOwner && gifts.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {(
              [
                { key: 'all', label: 'All items' },
                { key: 'available', label: 'Available' },
              ] as const
            ).map((f) => (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.filterChip, filter === f.key && styles.filterChipOn]}>
                <Text style={[styles.filterText, filter === f.key && styles.filterTextOn]}>{f.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {visibleGifts.map(renderGiftCard)}

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

      <AddGiftSheet
        visible={Boolean(editGift)}
        listTitle={wishlist?.title ?? 'Wishlist'}
        initialGift={editGift}
        onClose={() => setEditGift(null)}
        onSave={updateGift}
      />

      <ActionSheet
        visible={Boolean(menuGift)}
        title={menuGift ? shortProductTitle(menuGift.title) || menuGift.title : undefined}
        onClose={() => setMenuGift(null)}
        items={menuGift ? menuItems(menuGift) : []}
      />

      <Modal visible={Boolean(reserveGift)} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setReserveGift(null)} />
          <View style={styles.sheet} testID="claim-gift-sheet">
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Claim this gift</Text>
            <Muted>
              You&apos;re buying {reserveGift?.title ?? 'this'} so friends don&apos;t double up.
            </Muted>
            <Pressable
              style={[styles.option, visibility === 'secret' && styles.optionOn]}
              onPress={() => setVisibility('secret')}
              testID="claim-visibility-secret">
              <Text style={styles.optionTitle}>Keep it secret</Text>
              <Muted>They see it&apos;s claimed, not who claimed it</Muted>
            </Pressable>
            <Pressable
              style={[styles.option, visibility === 'notify' && styles.optionOn]}
              onPress={() => setVisibility('notify')}
              testID="claim-visibility-notify">
              <Text style={styles.optionTitle}>Let them know</Text>
              <Muted>They&apos;ll see you claimed it (in-app)</Muted>
            </Pressable>
            <Button label="Claim gift" onPress={confirmReserve} testID="confirm-claim-gift" />
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
  listHeading: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 30,
    color: theme.colors.ink,
    letterSpacing: -0.5,
  },
  ownerLine: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: theme.colors.muted,
    marginTop: 2,
  },
  listSummary: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: theme.colors.pink,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  metaChip: {
    backgroundColor: theme.colors.pinkSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  metaChipText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    color: theme.colors.pink,
  },
  metaDate: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: theme.colors.muted,
  },
  filters: {
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.line,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  filterChipOn: {
    backgroundColor: theme.colors.pink,
    borderColor: theme.colors.pink,
  },
  filterText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: theme.colors.muted,
  },
  filterTextOn: {
    color: '#fff',
    fontFamily: 'DMSans_700Bold',
  },
  giftCard: {
    padding: 14,
    gap: 12,
    overflow: 'hidden',
  },
  giftCardDim: {
    opacity: 0.78,
  },
  giftCardYours: {
    borderWidth: 1.5,
    borderColor: theme.colors.sage,
    backgroundColor: '#F4F8F4',
  },
  giftBody: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 14,
  },
  giftCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  giftTitle: {
    flex: 1,
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: theme.colors.ink,
    lineHeight: 22,
  },
  giftTitleStruck: {
    textDecorationLine: 'line-through',
    color: theme.colors.muted,
  },
  iconActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notes: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: theme.colors.muted,
    lineHeight: 18,
  },
  metaInline: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  price: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: theme.colors.pink,
  },
  priceStruck: {
    color: theme.colors.muted,
    textDecorationLine: 'line-through',
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: theme.colors.pinkSoft,
  },
  thumbDim: {
    opacity: 0.55,
  },
  thumbEmpty: {
    borderWidth: 1,
    borderColor: theme.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChip: {
    backgroundColor: theme.colors.pinkSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusChipText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    color: theme.colors.pink,
  },
  priorityChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  priorityChipText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
  },
  priorityHigh: { backgroundColor: theme.colors.pinkSoft },
  priorityHighText: { color: theme.colors.pink },
  priorityMedium: { backgroundColor: '#F8EFD9' },
  priorityMediumText: { color: '#9A6B16' },
  priorityLow: { backgroundColor: theme.colors.background },
  priorityLowText: { color: theme.colors.muted },
  purchasedPill: {
    backgroundColor: theme.colors.sageSoft,
  },
  yoursPill: {
    backgroundColor: theme.colors.sageSoft,
  },
  claimBtn: {
    backgroundColor: theme.colors.pink,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  claimBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: '#fff',
  },
  claimedBar: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  claimedBarText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: theme.colors.muted,
  },
  purchasedBtn: {
    borderWidth: 1.5,
    borderColor: theme.colors.sage,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.white,
  },
  purchasedBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: theme.colors.sage,
  },
  undoHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    opacity: 0.7,
  },
  releaseLink: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: 'center',
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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    gap: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.line,
    marginBottom: 4,
  },
  sheetTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 22,
    color: theme.colors.ink,
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
    backgroundColor: theme.colors.sageSoft,
  },
  optionTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: theme.colors.ink,
  },
});
