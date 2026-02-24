// components/SurfCard.tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors, scoreColor } from '../constants/theme';
import type { DailySurf } from '../types';

const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

interface Props {
  surf: DailySurf;
}

export function SurfCard({ surf }: Props) {
  const d = new Date(surf.date + 'T00:00:00');
  const day = dayNames[d.getDay()];
  return (
    <View style={styles.card}>
      <Text style={styles.day}>{day}</Text>
      <Text style={styles.wave}>{surf.waveHeightFt} ft</Text>
      <Text style={styles.detail}>{surf.wavePeriodS}s · {surf.swellDirection}</Text>
      <Text style={[styles.rating, { color: scoreColor(surf.qualityScore) }]}>
        {surf.surfRating} {surf.qualityScore}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 16, padding: 14, alignItems: 'center', flex: 1 },
  day: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },
  wave: { color: colors.text, fontSize: 18, fontWeight: '600' },
  detail: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  rating: { fontSize: 11, fontWeight: '600', marginTop: 6 },
});
