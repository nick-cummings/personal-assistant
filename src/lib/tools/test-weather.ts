/**
 * Manual test script for weather tool
 *
 * Usage:
 *   bun run src/lib/tools/test-weather.ts
 *
 * Environment variables required:
 *   OPEN_WEATHER_API_KEY=your-openweathermap-key
 *
 * Get a free API key at https://openweathermap.org/api
 */

import { createWeatherTool } from './weather';

async function main() {
  console.log('=== Weather Tool Test ===\n');

  const apiKey = process.env.OPEN_WEATHER_API_KEY;

  if (!apiKey) {
    console.error('Error: OPEN_WEATHER_API_KEY environment variable is required');
    console.error('Get a free API key at https://openweathermap.org/api');
    console.error('\nUsage:');
    console.error('  OPEN_WEATHER_API_KEY=xxx bun run src/lib/tools/test-weather.ts');
    process.exit(1);
  }

  console.log('API Key:', apiKey.substring(0, 8) + '...');
  console.log();

  const tools = createWeatherTool(apiKey);
  const weather = tools.weather;

  // Test 1: Get current weather by city name
  console.log('--- Test 1: Current weather by city name (Seattle) ---');
  try {
    const result = await weather.execute(
      { location: 'Seattle' },
      { toolCallId: 'test-1', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('Location:', result.location?.name, `(${result.location?.country})`);
      console.log('Coordinates:', result.location?.lat, result.location?.lon);
      console.log('Current:');
      console.log('  Temperature:', result.current?.temperature?.value, result.current?.temperature?.unit);
      console.log('  Feels like:', result.current?.feelsLike?.value, result.current?.feelsLike?.unit);
      console.log('  Conditions:', result.current?.conditions, '-', result.current?.description);
      console.log('  Humidity:', result.current?.humidity + '%');
      console.log('  Wind:', result.current?.wind?.speed, result.current?.wind?.unit);
      console.log('  Visibility:', result.current?.visibility);
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 2: Get weather with forecast
  console.log('--- Test 2: Weather with 5-day forecast (New York) ---');
  try {
    const result = await weather.execute(
      { location: 'New York, NY', includeForecast: true },
      { toolCallId: 'test-2', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('Location:', result.location?.name, `(${result.location?.country})`);
      console.log('Current:', result.current?.temperature?.value + result.current?.temperature?.unit, '-', result.current?.conditions);
      console.log('\n5-Day Forecast:');
      for (const day of result.forecast || []) {
        console.log(`  ${day.date}: ${day.tempMin?.value}-${day.tempMax?.value}${day.temperature?.unit}, ${day.conditions}`);
        console.log(`    ${day.description}, ${day.precipitationChance}% precipitation chance`);
      }
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 3: Metric units
  console.log('--- Test 3: Metric units (London) ---');
  try {
    const result = await weather.execute(
      { location: 'London, UK', units: 'metric', includeForecast: true },
      { toolCallId: 'test-3', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('Location:', result.location?.name, `(${result.location?.country})`);
      console.log('Temperature:', result.current?.temperature?.value, result.current?.temperature?.unit);
      console.log('Wind:', result.current?.wind?.speed, result.current?.wind?.unit);
      console.log('Conditions:', result.current?.conditions, '-', result.current?.description);
      console.log('\nForecast (first 3 days):');
      for (const day of (result.forecast || []).slice(0, 3)) {
        console.log(`  ${day.date}: ${day.temperature?.value}${day.temperature?.unit}, ${day.conditions}`);
      }
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 4: Imperial units
  console.log('--- Test 4: Imperial units (Los Angeles) ---');
  try {
    const result = await weather.execute(
      { location: 'Los Angeles, CA', units: 'imperial' },
      { toolCallId: 'test-4', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('Location:', result.location?.name, `(${result.location?.country})`);
      console.log('Temperature:', result.current?.temperature?.value, result.current?.temperature?.unit);
      console.log('Feels like:', result.current?.feelsLike?.value, result.current?.feelsLike?.unit);
      console.log('Wind:', result.current?.wind?.speed, result.current?.wind?.unit);
      console.log('Conditions:', result.current?.conditions);
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 5: International locations
  console.log('--- Test 5: International locations ---');
  const locations = ['Tokyo, Japan', 'Paris, France', 'Sydney, Australia', 'Mumbai, India'];
  for (const loc of locations) {
    try {
      const result = await weather.execute(
        { location: loc, units: 'metric' },
        { toolCallId: `test-5-${loc}`, messages: [] }
      );
      if ('error' in result) {
        console.log(`  ${loc}: Error - ${result.error}`);
      } else {
        console.log(`  ${loc}: ${result.current?.temperature?.value}°C, ${result.current?.conditions}`);
      }
    } catch (error) {
      console.error(`  ${loc}: Failed -`, error);
    }
  }
  console.log();

  // Test 6: Weather by coordinates
  console.log('--- Test 6: Weather by coordinates (San Francisco: 37.7749, -122.4194) ---');
  try {
    const result = await weather.execute(
      { location: '37.7749,-122.4194' },
      { toolCallId: 'test-6', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('Location:', result.location?.name, `(${result.location?.country})`);
      console.log('Coordinates:', result.location?.lat, result.location?.lon);
      console.log('Temperature:', result.current?.temperature?.value, result.current?.temperature?.unit);
      console.log('Conditions:', result.current?.conditions, '-', result.current?.description);
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 7: Weather with all details
  console.log('--- Test 7: Weather with all details (Chicago) ---');
  try {
    const result = await weather.execute(
      { location: 'Chicago, IL', units: 'imperial', includeForecast: true },
      { toolCallId: 'test-7', messages: [] }
    );
    if ('error' in result) {
      console.log('Error:', result.error);
    } else {
      console.log('Location:', result.location?.name, `(${result.location?.country})`);
      console.log('Coordinates:', result.location?.lat, result.location?.lon);
      console.log('\nCurrent Conditions:');
      console.log('  Temperature:', result.current?.temperature?.value, result.current?.temperature?.unit);
      console.log('  Feels like:', result.current?.feelsLike?.value, result.current?.feelsLike?.unit);
      console.log('  Conditions:', result.current?.conditions);
      console.log('  Description:', result.current?.description);
      console.log('  Humidity:', result.current?.humidity + '%');
      console.log('  Wind:', result.current?.wind?.speed, result.current?.wind?.unit);
      console.log('  Cloudiness:', result.current?.cloudiness + '%');
      console.log('  Visibility:', result.current?.visibility);
      if (result.current?.sunrise) console.log('  Sunrise:', result.current.sunrise);
      if (result.current?.sunset) console.log('  Sunset:', result.current.sunset);
      console.log('\nForecast:');
      for (const day of result.forecast || []) {
        console.log(`  ${day.date}:`);
        console.log(`    Temp: ${day.tempMin?.value}-${day.tempMax?.value}${day.temperature?.unit}`);
        console.log(`    ${day.conditions} - ${day.description}`);
        console.log(`    Wind: ${day.wind?.speed} ${day.wind?.unit}`);
        console.log(`    Precipitation: ${day.precipitationChance}%`);
      }
    }
    console.log();
  } catch (error) {
    console.error('Failed:', error);
  }

  // Test 8: Error handling - invalid location
  console.log('--- Test 8: Error handling - invalid location ---');
  try {
    const result = await weather.execute(
      { location: 'ThisCityDoesNotExist12345' },
      { toolCallId: 'test-8', messages: [] }
    );
    if ('error' in result) {
      console.log('Handled error (expected):', result.error);
    } else {
      console.log('Unexpected success:', result.location?.name);
    }
    console.log();
  } catch (error) {
    console.error('Threw:', error);
  }

  // Test 9: Error handling - no location provided
  console.log('--- Test 9: Error handling - no location ---');
  try {
    const result = await weather.execute(
      {},
      { toolCallId: 'test-9', messages: [] }
    );
    if ('error' in result) {
      console.log('Handled error (expected):', result.error);
    } else {
      console.log('Unexpected success');
    }
    console.log();
  } catch (error) {
    console.error('Threw:', error);
  }

  // Test 10: Extreme weather location
  console.log('--- Test 10: Extreme weather locations ---');
  const extremeLocations = ['Reykjavik, Iceland', 'Dubai, UAE', 'Anchorage, Alaska'];
  for (const loc of extremeLocations) {
    try {
      const result = await weather.execute(
        { location: loc, units: 'metric' },
        { toolCallId: `test-10-${loc}`, messages: [] }
      );
      if ('error' in result) {
        console.log(`  ${loc}: Error - ${result.error}`);
      } else {
        console.log(`  ${loc}: ${result.current?.temperature?.value}°C, ${result.current?.conditions}, Humidity: ${result.current?.humidity}%`);
      }
    } catch (error) {
      console.error(`  ${loc}: Failed -`, error);
    }
  }
  console.log();

  console.log('=== All tests complete ===');
}

main().catch(console.error);
