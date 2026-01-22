import { tool } from 'ai';
import { z } from 'zod';
import type { ToolSet } from '../connectors/types';

interface OpenWeatherCurrentResponse {
  coord: { lon: number; lat: number };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  visibility: number;
  wind: {
    speed: number;
    deg: number;
    gust?: number;
  };
  clouds: { all: number };
  dt: number;
  sys: {
    country: string;
    sunrise: number;
    sunset: number;
  };
  timezone: number;
  name: string;
}

interface OpenWeatherForecastResponse {
  city: {
    name: string;
    country: string;
    timezone: number;
  };
  list: Array<{
    dt: number;
    main: {
      temp: number;
      feels_like: number;
      temp_min: number;
      temp_max: number;
      humidity: number;
    };
    weather: Array<{
      main: string;
      description: string;
    }>;
    wind: {
      speed: number;
    };
    pop: number; // Probability of precipitation
    dt_txt: string;
  }>;
}

function formatWindDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

function kelvinToUnits(kelvin: number, units: 'celsius' | 'fahrenheit'): number {
  if (units === 'celsius') {
    return Math.round((kelvin - 273.15) * 10) / 10;
  }
  return Math.round(((kelvin - 273.15) * 9) / 5 + 32);
}

function mpsToUnits(mps: number, units: 'celsius' | 'fahrenheit'): { value: number; unit: string } {
  if (units === 'celsius') {
    // Convert m/s to km/h
    return { value: Math.round(mps * 3.6 * 10) / 10, unit: 'km/h' };
  }
  // Convert m/s to mph
  return { value: Math.round(mps * 2.237 * 10) / 10, unit: 'mph' };
}

export function createWeatherTool(apiKey: string): ToolSet {
  const weather = tool({
    description:
      'Get current weather conditions and forecasts for any location. Returns temperature, humidity, wind, and conditions. Supports city names or coordinates.',
    inputSchema: z.object({
      location: z
        .string()
        .describe(
          'City name (e.g., "London", "New York, US", "Tokyo, JP") or coordinates as "lat,lon" (e.g., "40.7128,-74.0060")'
        ),
      units: z
        .enum(['celsius', 'fahrenheit'])
        .optional()
        .default('fahrenheit')
        .describe('Temperature units (default: fahrenheit)'),
      forecast: z
        .boolean()
        .optional()
        .default(false)
        .describe('If true, include 5-day forecast in addition to current weather'),
    }),
    execute: async ({ location, units, forecast }) => {
      console.log(`[Weather ${new Date().toISOString()}] Getting weather for: ${location}`);

      // Ensure valid units (default to fahrenheit if undefined)
      const tempUnits = units ?? 'fahrenheit';

      try {
        // Validate location is provided
        if (!location) {
          return { error: 'Please provide a location (city name or coordinates)' };
        }

        // Determine if location is coordinates or city name
        const coordMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
        let queryParam: string;

        if (coordMatch) {
          queryParam = `lat=${coordMatch[1]}&lon=${coordMatch[2]}`;
        } else {
          queryParam = `q=${encodeURIComponent(location)}`;
        }

        // Fetch current weather
        const currentUrl = `https://api.openweathermap.org/data/2.5/weather?${queryParam}&appid=${apiKey}`;
        const currentResponse = await fetch(currentUrl);

        if (!currentResponse.ok) {
          if (currentResponse.status === 404) {
            return { error: `Location not found: ${location}` };
          }
          const errorText = await currentResponse.text();
          console.error(`[Weather ${new Date().toISOString()}] API error:`, errorText);
          return { error: `Weather API error: ${currentResponse.status}` };
        }

        const currentData: OpenWeatherCurrentResponse = await currentResponse.json();

        const wind = mpsToUnits(currentData.wind.speed, tempUnits);
        const gust = currentData.wind.gust ? mpsToUnits(currentData.wind.gust, tempUnits) : null;

        const result: {
          location: {
            name: string;
            country: string;
            coordinates: { lat: number; lon: number };
          };
          current: {
            temperature: number;
            feelsLike: number;
            tempMin: number;
            tempMax: number;
            unit: string;
            humidity: number;
            pressure: number;
            visibility: number;
            conditions: string;
            description: string;
            wind: {
              speed: number;
              unit: string;
              direction: string;
              gust?: number;
            };
            clouds: number;
            sunrise: string;
            sunset: string;
          };
          forecast?: Array<{
            date: string;
            temperature: number;
            feelsLike: number;
            tempMin: number;
            tempMax: number;
            humidity: number;
            conditions: string;
            description: string;
            wind: { speed: number; unit: string };
            precipitationChance: number;
          }>;
        } = {
          location: {
            name: currentData.name,
            country: currentData.sys.country,
            coordinates: {
              lat: currentData.coord.lat,
              lon: currentData.coord.lon,
            },
          },
          current: {
            temperature: kelvinToUnits(currentData.main.temp, tempUnits),
            feelsLike: kelvinToUnits(currentData.main.feels_like, tempUnits),
            tempMin: kelvinToUnits(currentData.main.temp_min, tempUnits),
            tempMax: kelvinToUnits(currentData.main.temp_max, tempUnits),
            unit: tempUnits === 'celsius' ? '°C' : '°F',
            humidity: currentData.main.humidity,
            pressure: currentData.main.pressure,
            visibility: Math.round(currentData.visibility / 1000), // Convert to km
            conditions: currentData.weather[0]?.main || 'Unknown',
            description: currentData.weather[0]?.description || '',
            wind: {
              speed: wind.value,
              unit: wind.unit,
              direction: formatWindDirection(currentData.wind.deg),
              gust: gust?.value,
            },
            clouds: currentData.clouds.all,
            sunrise: new Date(currentData.sys.sunrise * 1000).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            sunset: new Date(currentData.sys.sunset * 1000).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        };

        // Fetch forecast if requested
        if (forecast) {
          const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?${queryParam}&appid=${apiKey}`;
          const forecastResponse = await fetch(forecastUrl);

          if (forecastResponse.ok) {
            const forecastData: OpenWeatherForecastResponse = await forecastResponse.json();

            // Group by day and take one reading per day (noon or closest)
            const dailyForecasts = new Map<string, (typeof forecastData.list)[0]>();

            for (const item of forecastData.list) {
              const date = item.dt_txt.split(' ')[0];
              const hour = parseInt(item.dt_txt.split(' ')[1].split(':')[0], 10);

              // Prefer noon (12:00) readings, or take the first available
              const existing = dailyForecasts.get(date);
              if (!existing || Math.abs(hour - 12) < Math.abs(parseInt(existing.dt_txt.split(' ')[1].split(':')[0], 10) - 12)) {
                dailyForecasts.set(date, item);
              }
            }

            result.forecast = Array.from(dailyForecasts.values())
              .slice(0, 5)
              .map((item) => {
                const itemWind = mpsToUnits(item.wind.speed, tempUnits);
                return {
                  date: new Date(item.dt * 1000).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  }),
                  temperature: kelvinToUnits(item.main.temp, tempUnits),
                  feelsLike: kelvinToUnits(item.main.feels_like, tempUnits),
                  tempMin: kelvinToUnits(item.main.temp_min, tempUnits),
                  tempMax: kelvinToUnits(item.main.temp_max, tempUnits),
                  humidity: item.main.humidity,
                  conditions: item.weather[0]?.main || 'Unknown',
                  description: item.weather[0]?.description || '',
                  wind: { speed: itemWind.value, unit: itemWind.unit },
                  precipitationChance: Math.round(item.pop * 100),
                };
              });
          }
        }

        console.log(`[Weather ${new Date().toISOString()}] Got weather for ${result.location.name}`);

        return result;
      } catch (error) {
        console.error(`[Weather ${new Date().toISOString()}] Error:`, error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { error: `Failed to get weather: ${message}` };
      }
    },
  });

  return { weather };
}
