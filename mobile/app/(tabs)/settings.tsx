import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { colors } from '../../constants/theme';

export default function SettingsScreen() {
  const { prefs, updatePrefs, beaches, homeSpot, setHomeSpot } = useApp();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.sectionTitle}>Home Spot</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={homeSpot}
          onValueChange={setHomeSpot}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          {beaches.length === 0
            ? <Picker.Item label="Loading beaches..." value={homeSpot} />
            : beaches.map(b => (
                <Picker.Item key={b.slug} label={b.name} value={b.slug} />
              ))
          }
        </Picker>
      </View>

      <Text style={styles.sectionTitle}>Surf Preferences</Text>

      <Text style={styles.label}>Skill Level</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={prefs.skill}
          onValueChange={(v) => updatePrefs({ ...prefs, skill: v })}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          <Picker.Item label="Beginner" value="beginner" />
          <Picker.Item label="Intermediate" value="intermediate" />
          <Picker.Item label="Advanced" value="advanced" />
        </Picker>
      </View>

      <Text style={styles.label}>Min Wave Height: {prefs.minWave} ft</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={8}
        step={0.5}
        value={prefs.minWave}
        onSlidingComplete={(v) => updatePrefs({
          ...prefs,
          minWave: v,
          maxWave: Math.max(prefs.maxWave, v),
        })}
        minimumTrackTintColor={colors.blue}
        maximumTrackTintColor={colors.textDim}
        thumbTintColor={colors.blue}
      />

      <Text style={styles.label}>Max Wave Height: {prefs.maxWave} ft</Text>
      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={12}
        step={0.5}
        value={prefs.maxWave}
        onSlidingComplete={(v) => updatePrefs({
          ...prefs,
          maxWave: v,
          minWave: Math.min(prefs.minWave, v),
        })}
        minimumTrackTintColor={colors.blue}
        maximumTrackTintColor={colors.textDim}
        thumbTintColor={colors.blue}
      />

      <Text style={styles.label}>Cold Tolerance</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={prefs.cold}
          onValueChange={(v) => updatePrefs({ ...prefs, cold: v })}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          <Picker.Item label="Cold Averse (prefer > 65°F)" value="cold-averse" />
          <Picker.Item label="Moderate (fine > 55°F)" value="moderate" />
          <Picker.Item label="Tough (anything goes)" value="tough" />
        </Picker>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '300', textAlign: 'center', marginBottom: 24 },
  sectionTitle: { color: colors.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, marginTop: 16, marginBottom: 8 },
  label: { color: colors.textMuted, fontSize: 14, marginTop: 12, marginBottom: 4 },
  pickerWrap: { backgroundColor: colors.cardBg, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, overflow: 'hidden' },
  picker: { color: colors.text },
  pickerItem: { color: colors.text, fontSize: 16 },
  slider: { width: '100%', height: 40, marginTop: 4 },
});
