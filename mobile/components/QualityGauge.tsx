// components/QualityGauge.tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors, scoreColor } from '../constants/theme';

interface Props {
  score: number;
  rating: string;
}

export function QualityGauge({ score, rating }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Surf Quality</Text>
        <Text style={[styles.score, { color: scoreColor(score) }]}>{score}<Text style={styles.max}>/100</Text></Text>
      </View>
      <View style={styles.track}>
        <View style={{ flex: score }} />
        <View style={styles.needle} />
        <View style={{ flex: Math.max(100 - score, 0) }} />
      </View>
      <View style={styles.labels}>
        <Text style={styles.rangeLabel}>Flat</Text>
        <Text style={styles.rangeLabel}>Poor</Text>
        <Text style={styles.rangeLabel}>Fair</Text>
        <Text style={styles.rangeLabel}>Good</Text>
        <Text style={styles.rangeLabel}>Epic</Text>
      </View>
      <Text style={[styles.ratingText, { color: scoreColor(score) }]}>{rating}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  label: { color: colors.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  score: { fontSize: 20, fontWeight: '700' },
  max: { fontSize: 11, color: colors.textDim },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.textDim, flexDirection: 'row', alignItems: 'center' },
  needle: { width: 4, height: 18, backgroundColor: '#fff', borderRadius: 2, marginVertical: -4 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  rangeLabel: { color: colors.textDim, fontSize: 10 },
  ratingText: { fontSize: 15, fontWeight: '600', marginTop: 6 },
});
