// components/WeatherCard.tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';
import type { WeatherData } from '../types';

const conditionIcons: Record<string, string> = {
  'clear': '☀️', 'partly-cloudy': '⛅', 'overcast': '☁️',
  'fog': '🌫️', 'drizzle': '🌦️', 'rain': '🌧️',
  'freezing-rain': '🧊', 'snow': '❄️',
  'thunderstorm': '⛈️', 'unknown': '🌤️',
};

interface Props {
  weather: WeatherData;
  cityName: string;
}

export function WeatherCard({ weather, cityName }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{cityName} — Now</Text>
      <View style={styles.row}>
        <Text style={styles.icon}>{conditionIcons[weather.conditionIcon] || '🌤️'}</Text>
        <View>
          <Text style={styles.temp}>{Math.round(weather.currentTempF)}°</Text>
          <Text style={styles.condition}>{weather.condition}</Text>
        </View>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detail}>💨 {weather.windMph} mph</Text>
        <Text style={styles.detail}>💧 {weather.humidityPct}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 20, padding: 20, marginBottom: 12 },
  label: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  icon: { fontSize: 40 },
  temp: { color: colors.text, fontSize: 42, fontWeight: '600' },
  condition: { color: colors.textMuted, fontSize: 15, marginTop: 2 },
  detailRow: { flexDirection: 'row', gap: 20, marginTop: 14 },
  detail: { color: colors.textDim, fontSize: 13 },
});
