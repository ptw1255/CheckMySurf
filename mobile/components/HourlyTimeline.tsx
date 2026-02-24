// components/HourlyTimeline.tsx
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, scoreColor } from '../constants/theme';
import type { HourlySurf } from '../types';

interface Props {
  hourly: HourlySurf[];
}

function fmtHour(timeStr: string, now: Date): string {
  const d = new Date(timeStr);
  const h = d.getHours();
  if (d.getHours() === now.getHours() && d.toDateString() === now.toDateString()) return 'Now';
  if (h === 0) return '12a';
  if (h < 12) return h + 'a';
  if (h === 12) return '12p';
  return (h - 12) + 'p';
}

export function HourlyTimeline({ hourly }: Props) {
  const now = new Date();
  const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime();
  const startIdx = hourly.findIndex(h => new Date(h.time).getTime() >= currentHour);
  const hours = hourly.slice(Math.max(startIdx, 0), Math.max(startIdx, 0) + 24);

  if (hours.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Surf Timeline</Text>
        <Text style={{ color: colors.textDim, fontSize: 12 }}>No hourly data available</Text>
      </View>
    );
  }

  const maxWave = Math.max(...hours.map(h => h.waveHeightFt), 1);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Surf Timeline</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {hours.map((h, i) => {
          const barPct = Math.round((h.waveHeightFt / maxWave) * 100);
          const clr = scoreColor(h.qualityScore);
          return (
            <View key={i} style={styles.hour}>
              <Text style={styles.time}>{fmtHour(h.time, now)}</Text>
              <View style={styles.barWrap}>
                <View style={[styles.bar, { height: Math.max(barPct, 8) * 0.7, backgroundColor: clr }]} />
              </View>
              <Text style={[styles.wave, { color: clr }]}>{h.waveHeightFt}'</Text>
              <Text style={styles.period}>{h.wavePeriodS}s</Text>
              <Text style={styles.dir}>{h.swellDirection}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 16, padding: 16, marginBottom: 12 },
  title: { color: colors.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 },
  scroll: { gap: 2 },
  hour: { alignItems: 'center', width: 48, paddingVertical: 4 },
  time: { color: colors.textDim, fontSize: 11, marginBottom: 6 },
  barWrap: { width: 24, height: 70, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 12 },
  wave: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  period: { color: colors.textDim, fontSize: 10 },
  dir: { color: colors.textDim, fontSize: 10 },
});
