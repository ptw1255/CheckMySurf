// components/BeachCard.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, ratingColors } from '../constants/theme';
import type { BeachSummary } from '../types';

interface Props {
  beach: BeachSummary;
  isActive: boolean;
  isHome: boolean;
  onPress: (slug: string) => void;
  onStar: (slug: string) => void;
}

function BeachCardInner({ beach, isActive, isHome, onPress, onStar }: Props) {
  const handlePress = () => onPress(beach.slug);
  const handleStar = () => onStar(beach.slug);

  return (
    <Pressable
      style={[styles.card, isActive && styles.active]}
      onPress={handlePress}
    >
      <View style={[styles.dot, { backgroundColor: ratingColors[beach.ratingColor] || colors.red }]} />
      <View style={styles.info}>
        <Text style={styles.name}>{beach.name}</Text>
        <Text style={styles.stats}>{beach.waveHeightFt}ft · {beach.surfRating}</Text>
      </View>
      <Pressable onPress={handleStar} hitSlop={8}>
        <Text style={[styles.star, isHome && styles.starred]}>
          {isHome ? '\u2605' : '\u2606'}
        </Text>
      </Pressable>
    </Pressable>
  );
}

export const BeachCard = React.memo(BeachCardInner);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    marginBottom: 10,
  },
  active: {
    borderColor: 'rgba(59,130,246,0.5)',
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  stats: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  star: { fontSize: 22, color: colors.textDim, opacity: 0.3 },
  starred: { color: '#fbbf24', opacity: 1 },
});
