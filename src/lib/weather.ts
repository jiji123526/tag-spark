export type WeatherData = {
  condition: string; // rain, clear, clouds, snow, thunderstorm, drizzle, fog
  temp: number;
  isNight: boolean;
};

// WMO Weather Code mapping
function wmoToCondition(code: number): string {
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3) return "clouds";
  if (code >= 45 && code <= 48) return "fog";
  if (code >= 51 && code <= 55) return "drizzle";
  if (code >= 56 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 65) return "rain";
  if (code >= 66 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 95 && code <= 99) return "thunderstorm";
  return "clear";
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
  );
  if (!res.ok) throw new Error("Weather fetch failed");
  const data = await res.json();
  const { weathercode, temperature, is_day } = data.current_weather;
  return {
    condition: wmoToCondition(weathercode),
    temp: temperature,
    isNight: is_day === 0,
  };
}

export function getLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 30000, enableHighAccuracy: false, maximumAge: 300000 }
    );
  });
}
