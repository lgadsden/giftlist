import AsyncStorage from '@react-native-async-storage/async-storage';

const keyFor = (userId: string) => `giftlist:likes:${userId}`;

export async function loadLikedGiftIds(userId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export async function toggleLikedGift(
  userId: string,
  giftId: string,
): Promise<Set<string>> {
  const next = await loadLikedGiftIds(userId);
  if (next.has(giftId)) next.delete(giftId);
  else next.add(giftId);
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify([...next]));
  return next;
}
