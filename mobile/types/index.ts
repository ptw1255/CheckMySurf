// types/index.ts
export interface BeachSummary {
  slug: string;
  name: string;
  weatherCity: string;
  qualityScore: number;
  surfRating: string;
  waveHeightFt: number;
  ratingColor: 'red' | 'yellow' | 'green';
}

export interface WeatherData {
  currentTempF: number;
  condition: string;
  conditionIcon: string;
  windMph: number;
  humidityPct: number;
  daily: DailyForecast[];
}

export interface DailyForecast {
  date: string;
  highF: number;
  lowF: number;
  condition: string;
  conditionIcon: string;
}

export interface BeachData {
  seaTempF: number;
  waveHeightFt: number;
  wavePeriodS: number;
  swellDirection: string;
  surfRating: string;
  qualityScore: number;
  hourly: HourlySurf[];
  daily: DailySurf[];
}

export interface HourlySurf {
  time: string;
  waveHeightFt: number;
  wavePeriodS: number;
  swellDirection: string;
  surfRating: string;
  qualityScore: number;
}

export interface DailySurf {
  date: string;
  waveHeightFt: number;
  wavePeriodS: number;
  swellDirection: string;
  surfRating: string;
  qualityScore: number;
}

export interface UserPrefs {
  skill: 'beginner' | 'intermediate' | 'advanced';
  minWave: number;
  maxWave: number;
  cold: 'cold-averse' | 'moderate' | 'tough';
}
