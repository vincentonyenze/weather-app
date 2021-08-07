// ===== DOM elements =====
const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const statusEl = document.getElementById("status");
const currentSection = document.getElementById("current-weather");
const locationName = document.getElementById("location-name");
const locationDetail = document.getElementById("location-detail");
const currentTemp = document.getElementById("current-temp");
const currentDescription = document.getElementById("current-description");
const feelsLike = document.getElementById("feels-like");
const humidity = document.getElementById("humidity");
const wind = document.getElementById("wind");
const updatedTime = document.getElementById("updated-time");

// ===== Config =====
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const MAX_CITY_RESULTS = 5;

// The values we ask the forecast API for
const CURRENT_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "wind_speed_10m",
  "weather_code",
  "is_day",
];

// ===== API =====
// City name -> array of matching places (with latitude and longitude)
async function searchCities(name) {
  const params = new URLSearchParams({
    name,
    count: MAX_CITY_RESULTS,
    language: "en",
    format: "json",
  });

  const response = await fetch(`${GEOCODING_URL}?${params}`);
  const data = await response.json();

  // When nothing matches, the API leaves out `results` entirely
  return data.results ?? [];
}

// Coordinates -> weather data
async function fetchWeather(latitude, longitude) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: CURRENT_FIELDS.join(","),
    timezone: "auto", // times come back in the city's own time zone
  });

  const response = await fetch(`${FORECAST_URL}?${params}`);
  return response.json();
}

// ===== Formatting =====
function formatTemperature(value) {
  return `${Math.round(value)}°`;
}

// "Lagos, Nigeria" -- skipping any part the API didn't send
function formatPlaceDetail(place) {
  return [place.admin1, place.country].filter(Boolean).join(", ");
}

// "2026-10-17T14:00" -> "14:00"
function formatLocalTime(isoString) {
  return isoString.split("T")[1];
}

// ===== Rendering =====
function renderCurrentWeather(place, weather) {
  const { current, current_units: units } = weather;

  locationName.textContent = place.name;
  locationDetail.textContent = formatPlaceDetail(place);

  currentTemp.textContent = formatTemperature(current.temperature_2m);
  // Temporary: turned into words and an icon in Step 7
  currentDescription.textContent = `Weather code ${current.weather_code}`;

  feelsLike.textContent = formatTemperature(current.apparent_temperature);
  humidity.textContent = `${current.relative_humidity_2m}${units.relative_humidity_2m}`;
  wind.textContent = `${Math.round(current.wind_speed_10m)} ${units.wind_speed_10m}`;
  updatedTime.textContent = `Updated ${formatLocalTime(current.time)} local time`;

  statusEl.hidden = true;
  currentSection.hidden = false;
}

// ===== Event handlers =====
async function handleSearch(event) {
  event.preventDefault();

  const query = cityInput.value.trim();
  if (!query) return;

  const cities = await searchCities(query);
  if (cities.length === 0) {
    console.warn(`No city found for "${query}"`); // proper message in Step 9
    return;
  }

  // For now, use the best match (choosing between cities comes in Step 11)
  const place = cities[0];
  const weather = await fetchWeather(place.latitude, place.longitude);
  renderCurrentWeather(place, weather);
}

// ===== Init =====
searchForm.addEventListener("submit", handleSearch);
