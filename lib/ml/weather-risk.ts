// ============================================================================
// Weather Risk Calculator
// Uses 7-day forecast from Open-Meteo to compute disruption probability
// ============================================================================

import { get7DayForecast, getAQIFallback } from '@/lib/clients/open-meteo';
import { TRIGGERS, PREMIUM, SEASONAL_RISK } from '@/lib/config/constants';

interface WeatherRiskResult {
  weatherRisk: number;
  disruptionProbability: number;
  seasonalMultiplier: number;
  heavyRainDays: number;
  highWindDays: number;
  aqiBaseline: number;
}

/**
 * Calculate weather risk addon for premium
 * - Fetch 7-day forecast from Open-Meteo
 * - Count days with rain > 65mm, wind > 70km/h
 * - Get AQI baseline for seasonal context
 * - disruption_probability = weighted sum of factors
 * - weather_risk = probability * 20, clamped [10, 20]
 * - Apply seasonal multiplier
 */
export async function calculateWeatherRisk(
  city: string,
  lat: number,
  lng: number
): Promise<WeatherRiskResult> {
  // Fetch forecast and AQI in parallel
  const [forecast, aqiData] = await Promise.all([
    get7DayForecast(lat, lng),
    getAQIFallback(lat, lng),
  ]);

  // Count disruption days
  const heavyRainDays = forecast.filter(
    (day) => day.precipitation_sum_mm >= TRIGGERS.heavy_rainfall.threshold
  ).length;

  const highWindDays = forecast.filter(
    (day) => day.wind_speed_max_kmh >= TRIGGERS.cyclone.threshold
  ).length;

  const aqiBaseline = aqiData?.aqi ?? 0;

  // Compute disruption probability as weighted sum
  const totalDays = Math.max(forecast.length, 1);
  const rainFactor = heavyRainDays / totalDays; // 0 to 1
  const windFactor = highWindDays / totalDays; // 0 to 1
  const aqiFactor = aqiBaseline >= TRIGGERS.aqi_grap_iv.threshold ? 1.0 : aqiBaseline / 500; // 0 to 1

  // Weighted probability
  const disruptionProbability = Math.min(
    1.0,
    rainFactor * 0.45 + windFactor * 0.35 + aqiFactor * 0.20
  );

  // Get seasonal multiplier
  const month = new Date().getMonth();
  const seasonalMultiplier = SEASONAL_RISK[month] ?? 1.0;

  // Calculate weather risk: probability * range * seasonal, clamped to [10, 20]
  const range = PREMIUM.WEATHER_RISK_MAX - PREMIUM.WEATHER_RISK_MIN;
  const rawRisk = PREMIUM.WEATHER_RISK_MIN + disruptionProbability * range * seasonalMultiplier;
  const weatherRisk = Math.round(
    Math.min(PREMIUM.WEATHER_RISK_MAX, Math.max(PREMIUM.WEATHER_RISK_MIN, rawRisk))
  );

  return {
    weatherRisk,
    disruptionProbability,
    seasonalMultiplier,
    heavyRainDays,
    highWindDays,
    aqiBaseline,
  };
}
