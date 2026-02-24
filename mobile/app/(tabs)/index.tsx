// app/(tabs)/index.tsx
import { useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { BeachCard } from '../../components/BeachCard';
import { colors } from '../../constants/theme';

export default function BeachesScreen() {
  const { beaches, selectedSlug, homeSpot, selectBeach, setHomeSpot, refresh, loading, error } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handlePress = useCallback((slug: string) => {
    selectBeach(slug);
    router.push('/(tabs)/detail');
  }, [selectBeach, router]);

  const handleStar = useCallback((slug: string) => {
    setHomeSpot(slug);
  }, [setHomeSpot]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>CheckMySurf</Text>
      <Text style={styles.subtitle}>NC Beach Conditions</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={beaches}
        keyExtractor={(b) => b.slug}
        renderItem={({ item }) => (
          <BeachCard
            beach={item}
            isActive={item.slug === selectedSlug}
            isHome={item.slug === homeSpot}
            onPress={handlePress}
            onStar={handleStar}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.blue} />
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 28, fontWeight: '300', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { color: colors.blue, fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  error: { color: colors.red, textAlign: 'center', padding: 16, fontSize: 14 },
  list: { padding: 16 },
});
