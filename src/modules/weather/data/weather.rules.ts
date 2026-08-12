import type { WeatherAlert, WeatherLocation, WeatherRiskLevel } from "../weather.types";

export function getSevenDayRainfall(location: WeatherLocation) {
  return roundRainfall(location.forecast.reduce((total, day) => total + day.rainfallMm, 0));
}

export function getWeatherRiskLevel(location: Pick<WeatherLocation, "rainRisk" | "forecast">): WeatherRiskLevel {
  const rainfall7d = location.forecast.reduce((total, day) => total + day.rainfallMm, 0);
  if (rainfall7d >= 150 || location.rainRisk >= 70) return "HIGH";
  if (rainfall7d >= 50 || location.rainRisk >= 45) return "MEDIUM";
  return "LOW";
}

export function buildWeatherAlerts(locations: WeatherLocation[]): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  const severeLocations = locations.filter(
    (location) => location.rainRisk >= 70 || location.condition === "Thunderstorms",
  );
  const heavyRainLocations = locations.filter((location) => getSevenDayRainfall(location) >= 150);
  const wetRouteLocations = locations.filter((location) => location.rainfall24h >= 30);

  if (severeLocations.length) {
    const maxRainRisk = Math.max(...severeLocations.map((location) => location.rainRisk));
    alerts.push({
      id: "alert-live-severe-rain",
      title: "High rain risk in monitored areas",
      description: `${severeLocations.map((location) => location.name).join(", ")} show high rain probability in the live forecast.`,
      severity: "HIGH",
      metric: `${maxRainRisk}% peak probability`,
      locationIds: severeLocations.map((location) => location.id),
    });
  }

  if (heavyRainLocations.length) {
    const maxRainfall = Math.max(...heavyRainLocations.map(getSevenDayRainfall));
    alerts.push({
      id: "alert-live-heavy-rain",
      title: "Heavy rain window needs route review",
      description: `${heavyRainLocations.map((location) => location.name).join(", ")} exceed the seven-day agriculture planning threshold.`,
      severity: "HIGH",
      metric: `${maxRainfall} mm / 7 days`,
      locationIds: heavyRainLocations.map((location) => location.id),
    });
  }

  if (wetRouteLocations.length) {
    const maxRainfall = Math.max(...wetRouteLocations.map((location) => location.rainfall24h));
    alerts.push({
      id: "alert-live-wet-routes",
      title: "Wet-route planning may be needed",
      description: `${wetRouteLocations.map((location) => location.name).join(", ")} have elevated rainfall in the latest 24-hour window.`,
      severity: "MEDIUM",
      metric: `${maxRainfall} mm / 24 hours`,
      locationIds: wetRouteLocations.map((location) => location.id),
    });
  }

  return alerts;
}

function roundRainfall(value: number) {
  return Math.round(value * 10) / 10;
}
