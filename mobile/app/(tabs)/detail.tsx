// app/(tabs)/detail.tsx
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { WeatherCard } from '../../components/WeatherCard';
import { QualityGauge } from '../../components/QualityGauge';
import { HourlyTimeline } from '../../components/HourlyTimeline';
import { SurfCard } from '../../components/SurfCard';
import { colors } from '../../constants/theme';

export default function DetailScreen() {
  const { beaches, selectedSlug, beachData, weatherData, loading, error, refresh } = useApp();
  const insets = useSafeAreaInsets();
  const beachInfo = beaches.find(b => b.slug === selectedSlug);
  const beachName = beachInfo?.name || selectedSlug;
  const weatherCity = beachInfo?.weatherCity || beachName;

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!beachData || !weatherData) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.blue} />}
    >
      <Text style={styles.title}>{beachName}</Text>

      <WeatherCard weather={weatherData} cityName={weatherCity} />

      <View style={styles.surfCard}>
        <Text style={styles.label}>Surf</Text>
        <Text style={styles.waveText}>🌊 {beachData.waveHeightFt} ft <Text style={styles.waveSub}>@ {beachData.wavePeriodS}s from {beachData.swellDirection}</Text></Text>
        <Text style={styles.seaTemp}>Sea Temp: {Math.round(beachData.seaTempF)}°F</Text>
        <QualityGauge score={beachData.qualityScore} rating={beachData.surfRating} />
      </View>

      <HourlyTimeline hourly={beachData.hourly} />

      <Text style={styles.sectionTitle}>Daily Surf Forecast</Text>
      <View style={styles.dailyRow}>
        {beachData.daily.map((d, i) => (
          <SurfCard key={i} surf={d} />
        ))}
      </View>

      <Text style={styles.sectionTitle}>5-Day Weather</Text>
      {weatherData.daily.map((d, i) => {
        const date = new Date(d.date + 'T00:00:00');
        const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()];
        return (
          <View key={i} style={styles.forecastRow}>
            <Text style={styles.forecastDay}>{dayName}</Text>
            <Text style={styles.forecastCondition}>{d.condition}</Text>
            <Text style={styles.forecastTemps}>{Math.round(d.highF)}° / {Math.round(d.lowF)}°</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16 },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  loading: { color: colors.textDim, fontSize: 16 },
  error: { color: colors.red, fontSize: 14, padding: 20, textAlign: 'center' },
  title: { color: colors.text, fontSize: 24, fontWeight: '300', textAlign: 'center', marginBottom: 20 },
  surfCard: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 20, padding: 20, marginBottom: 12 },
  label: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 },
  waveText: { color: colors.text, fontSize: 20, fontWeight: '600' },
  waveSub: { color: colors.textDim, fontSize: 14, fontWeight: '400' },
  seaTemp: { color: colors.text, fontSize: 16, marginTop: 8 },
  sectionTitle: { color: colors.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, marginTop: 8, marginBottom: 12 },
  dailyRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  forecastRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  forecastDay: { color: colors.text, fontSize: 14, fontWeight: '600', width: 40 },
  forecastCondition: { color: colors.textMuted, fontSize: 14, flex: 1 },
  forecastTemps: { color: colors.text, fontSize: 14 },
});
