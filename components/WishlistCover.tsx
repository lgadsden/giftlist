import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/Colors';
import { EVENT_COVERS } from '@/lib/eventCovers';
import type { EventType } from '@/lib/domain';

type Props = {
  eventType: EventType;
  coverImageUrl?: string | null;
  /** Shown over the bottom of the cover (e.g. countdown / date). */
  badge?: string;
  height?: number;
};

export function WishlistCover({ eventType, coverImageUrl, badge, height = 128 }: Props) {
  const cover = EVENT_COVERS[eventType] ?? EVENT_COVERS.general;

  return (
    <View style={[styles.hero, { height, backgroundColor: cover.background }]}>
      {coverImageUrl ? (
        <Image source={{ uri: coverImageUrl }} style={styles.photo} resizeMode="cover" />
      ) : (
        <>
          <MaterialCommunityIcons
            name={cover.icon}
            size={88}
            color="rgba(255,255,255,0.18)"
            style={styles.iconBack}
          />
          <MaterialCommunityIcons
            name={cover.icon}
            size={40}
            color="rgba(255,255,255,0.5)"
            style={styles.iconFront}
          />
        </>
      )}
      <View style={styles.scrim} pointerEvents="none" />
      {badge ? (
        <View style={styles.badgeWrap}>
          <Text style={styles.badge}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: 'hidden',
    backgroundColor: theme.colors.sage,
  },
  photo: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  iconBack: {
    position: 'absolute',
    right: -8,
    bottom: -14,
  },
  iconFront: {
    position: 'absolute',
    right: 36,
    top: 36,
  },
  badgeWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.35)',
    color: '#fff',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
  },
});
