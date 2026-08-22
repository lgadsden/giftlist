import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Button, Card, Field, Muted, Screen, Title } from '@/components/ui';
import { theme } from '@/constants/Colors';
import { useAuth } from '@/lib/auth';
import { orderedPair } from '@/lib/friends';
import { supabase } from '@/lib/supabase';

type ProfileHit = {
  id: string;
  username: string;
  display_name: string;
};

type FriendshipRow = {
  id: string;
  user_a: string;
  user_b: string;
  requester_id: string;
  status: string;
};

type GroupRow = {
  id: string;
  name: string;
};

type GroupMember = ProfileHit & { role: string };

export default function FriendsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ProfileHit[]>([]);
  const [requests, setRequests] = useState<(FriendshipRow & { other?: ProfileHit })[]>([]);
  const [friends, setFriends] = useState<ProfileHit[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupMembers, setGroupMembers] = useState<Record<string, GroupMember[]>>({});
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [groupName, setGroupName] = useState('');

  const loadGroupMembers = useCallback(async (groupId: string) => {
    const { data: rows } = await supabase
      .from('group_members')
      .select('role, user_id')
      .eq('group_id', groupId);
    const memberRows = (rows as { role: string; user_id: string }[]) ?? [];
    if (!memberRows.length) {
      setGroupMembers((prev) => ({ ...prev, [groupId]: [] }));
      return;
    }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .in(
        'id',
        memberRows.map((r) => r.user_id),
      );
    const byId = Object.fromEntries(((profiles as ProfileHit[]) ?? []).map((p) => [p.id, p]));
    setGroupMembers((prev) => ({
      ...prev,
      [groupId]: memberRows
        .map((r) => {
          const p = byId[r.user_id];
          if (!p) return null;
          return { ...p, role: r.role };
        })
        .filter(Boolean) as GroupMember[],
    }));
  }, []);

  const load = useCallback(async () => {
    if (!user) return;

    const { data: friendships } = await supabase
      .from('friendships')
      .select('id, user_a, user_b, requester_id, status')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

    const rows = (friendships as FriendshipRow[]) ?? [];
    const pending = rows.filter((f) => f.status === 'pending' && f.requester_id !== user.id);
    const accepted = rows.filter((f) => f.status === 'accepted');
    const otherIds = [
      ...new Set(
        [...pending, ...accepted].map((f) => (f.user_a === user.id ? f.user_b : f.user_a)),
      ),
    ];

    let profilesById: Record<string, ProfileHit> = {};
    if (otherIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', otherIds);
      profilesById = Object.fromEntries(((profiles as ProfileHit[]) ?? []).map((p) => [p.id, p]));
    }

    setRequests(
      pending.map((f) => ({
        ...f,
        other: profilesById[f.user_a === user.id ? f.user_b : f.user_a],
      })),
    );
    setFriends(
      accepted
        .map((f) => profilesById[f.user_a === user.id ? f.user_b : f.user_a])
        .filter(Boolean),
    );

    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name)')
      .eq('user_id', user.id);

    const mapped =
      memberships
        ?.map((m: { groups: GroupRow | GroupRow[] | null }) => {
          const g = Array.isArray(m.groups) ? m.groups[0] : m.groups;
          return g;
        })
        .filter(Boolean) ?? [];
    const nextGroups = mapped as GroupRow[];
    setGroups(nextGroups);
    await Promise.all(nextGroups.map((g) => loadGroupMembers(g.id)));
  }, [user, loadGroupMembers]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const search = async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) {
      setHits([]);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .or(`username.ilike.%${text.trim()}%,display_name.ilike.%${text.trim()}%`)
      .neq('id', user?.id ?? '00000000-0000-0000-0000-000000000000')
      .limit(8);
    setHits((data as ProfileHit[]) ?? []);
  };

  const sendRequest = async (otherId: string) => {
    if (!user) return;
    const [user_a, user_b] = orderedPair(user.id, otherId);
    const { error } = await supabase.from('friendships').insert({
      user_a,
      user_b,
      requester_id: user.id,
      status: 'pending',
    });
    if (error) Alert.alert('Could not send request', error.message);
    else {
      Alert.alert('Request sent');
      await load();
    }
  };

  const respond = async (friendshipId: string, status: 'accepted' | 'declined') => {
    const { error } = await supabase.from('friendships').update({ status }).eq('id', friendshipId);
    if (error) Alert.alert('Error', error.message);
    await load();
  };

  const copyInvite = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('friend_invites')
      .insert({ created_by: user.id })
      .select('token')
      .single();
    if (error) {
      Alert.alert('Invite error', error.message);
      return;
    }
    const url = Linking.createURL(`invite/${data.token}`);
    setInviteUrl(url);
    Alert.alert('Invite link ready', url);
  };

  const createGroup = async () => {
    if (!user || !groupName.trim()) return;
    const { data: group, error } = await supabase
      .from('groups')
      .insert({ name: groupName.trim(), created_by: user.id })
      .select('id')
      .single();
    if (error || !group) {
      Alert.alert('Group error', error?.message ?? 'Unknown error');
      return;
    }
    await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: user.id,
      role: 'admin',
    });
    setGroupName('');
    setExpandedGroupId(group.id);
    await load();
  };

  const addFriendToGroup = async (groupId: string, friendId: string) => {
    const { error } = await supabase.from('group_members').insert({
      group_id: groupId,
      user_id: friendId,
      role: 'member',
    });
    if (error) Alert.alert('Could not add member', error.message);
    await loadGroupMembers(groupId);
    await load();
  };

  const removeFromGroup = async (groupId: string, memberUserId: string) => {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', memberUserId);
    if (error) Alert.alert('Could not remove member', error.message);
    await loadGroupMembers(groupId);
    await load();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Title>Friends</Title>
        <Pressable onPress={copyInvite} testID="copy-invite-link">
          <Text style={styles.link}>Copy invite link</Text>
        </Pressable>
      </View>
      {inviteUrl ? (
        <Text style={styles.inviteUrl} testID="invite-url" selectable>
          {inviteUrl}
        </Text>
      ) : null}

      <TextInput
        value={query}
        onChangeText={search}
        placeholder="Search by username or email…"
        placeholderTextColor={theme.colors.muted}
        style={styles.search}
        testID="friend-search"
        accessibilityLabel="Search friends"
      />

      {hits.length > 0 ? (
        <Card style={{ gap: 8, marginBottom: 12 }}>
          {hits.map((hit) => (
            <View key={hit.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{hit.display_name}</Text>
                <Muted>@{hit.username}</Muted>
              </View>
              <Button
                label="Add"
                variant="soft"
                onPress={() => sendRequest(hit.id)}
                testID={`add-friend-${hit.username}`}
              />
            </View>
          ))}
        </Card>
      ) : null}

      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <Text style={styles.section}>Friend requests ({requests.length})</Text>
            {requests.length === 0 ? (
              <Muted>No pending requests.</Muted>
            ) : (
              requests.map((req) => (
                <Card key={req.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{req.other?.display_name ?? 'Someone'}</Text>
                    <Muted>@{req.other?.username ?? 'unknown'}</Muted>
                  </View>
                  <Pressable
                    style={styles.accept}
                    onPress={() => respond(req.id, 'accepted')}
                    testID={`accept-friend-${req.other?.username ?? req.id}`}>
                    <Text style={styles.acceptText}>✓</Text>
                  </Pressable>
                  <Pressable style={styles.decline} onPress={() => respond(req.id, 'declined')}>
                    <Text style={styles.declineText}>✕</Text>
                  </Pressable>
                </Card>
              ))
            )}
            <Text style={styles.section}>Your friends ({friends.length})</Text>
          </View>
        }
        ListEmptyComponent={<Muted>No friends yet — search or share an invite link.</Muted>}
        ListFooterComponent={
          <View style={{ gap: 12, marginTop: 20, paddingBottom: 120 }} testID="groups-section">
            <Text style={styles.section}>Groups</Text>
            {groups.map((g) => {
              const members = groupMembers[g.id] ?? [];
              const expanded = expandedGroupId === g.id;
              const memberIds = new Set(members.map((m) => m.id));
              const addableFriends = friends.filter((f) => !memberIds.has(f.id));
              return (
                <Card key={g.id} style={{ gap: 10 }} testID={`group-card-${g.name}`}>
                  <Pressable
                    onPress={() => setExpandedGroupId(expanded ? null : g.id)}
                    style={styles.row}
                    testID={`group-toggle-${g.name}`}>
                    <Text style={[styles.name, { flex: 1 }]}>{g.name}</Text>
                    <Muted>{expanded ? 'Hide' : 'Manage'}</Muted>
                  </Pressable>
                  {expanded ? (
                    <View style={{ gap: 8 }} testID={`group-members-${g.name}`}>
                      {members.map((m) => (
                        <View key={m.id} style={styles.row}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.name}>{m.display_name}</Text>
                            <Muted>
                              @{m.username} · {m.role}
                            </Muted>
                          </View>
                          {m.id !== user?.id ? (
                            <Pressable
                              testID={`remove-member-${g.name}-${m.username}`}
                              onPress={() => removeFromGroup(g.id, m.id)}>
                              <Text style={styles.remove}>Remove</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ))}
                      {addableFriends.length ? (
                        <View style={{ gap: 6 }}>
                          <Text style={styles.miniSection}>Add friends</Text>
                          {addableFriends.map((f) => (
                            <View key={f.id} style={styles.row}>
                              <Text style={[styles.name, { flex: 1 }]}>{f.display_name}</Text>
                              <Button
                                label="Add"
                                variant="soft"
                                testID={`add-member-${g.name}-${f.username}`}
                                onPress={() => addFriendToGroup(g.id, f.id)}
                              />
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Muted>All friends are already in this group.</Muted>
                      )}
                    </View>
                  ) : null}
                </Card>
              );
            })}
            <Field
              label="New group"
              value={groupName}
              onChangeText={setGroupName}
              testID="new-group-input"
            />
            <Button
              label="Create group"
              variant="sage"
              onPress={createGroup}
              testID="create-group-button"
            />
          </View>
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 8 }} testID={`friend-row-${item.username}`}>
            <View style={styles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.display_name}
                </Text>
                <Muted>@{item.username}</Muted>
              </View>
              <Pressable
                style={styles.viewList}
                onPress={() => router.push(`/friend/${item.id}`)}
                testID={`view-wishlist-${item.username}`}
                accessibilityLabel={`View ${item.display_name}'s wishlist`}>
                <Text style={styles.viewListText}>View Wishlist</Text>
              </Pressable>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  link: { color: theme.colors.pink, fontFamily: 'DMSans_700Bold', fontSize: 14 },
  inviteUrl: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: theme.colors.muted,
    marginBottom: 4,
  },
  search: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: 12,
    fontFamily: 'DMSans_400Regular',
    color: theme.colors.ink,
  },
  section: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.pink,
  },
  miniSection: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.colors.muted,
    marginTop: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: 'DMSans_700Bold', fontSize: 15, color: theme.colors.ink },
  remove: { color: theme.colors.pink, fontFamily: 'DMSans_700Bold', fontSize: 13 },
  accept: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: { color: '#fff', fontWeight: '700' },
  decline: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
  },
  declineText: { color: theme.colors.muted, fontWeight: '700' },
  viewList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.colors.pinkSoft,
    borderWidth: 1,
    borderColor: 'rgba(216, 27, 96, 0.2)',
  },
  viewListText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: theme.colors.pink,
  },
});
