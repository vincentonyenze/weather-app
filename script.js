// ===== DOM elements =====
const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const statusEl = document.getElementById("status");
const statusMessage = document.getElementById("status-message");
const currentSection = document.getElementById("current-weather");
const locationName = document.getElementById("location-name");
const locationDetail = document.getElementById("location-detail");
const currentIcon = document.getElementById("current-icon");
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

// ===== Errors =====
// The request never reached the server (offline, DNS, blocked...)
class NetworkError extends Error {
  constructor() {
    super("Could not reach the server");
    this.name = "NetworkError";
  }
}

// The server answered, but with an error status like 400 or 500
class ApiError extends Error {
  constructor(status, reason) {
    super(reason || `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
  }
}

// Turn any error into a message a user can act on
function getErrorMessage(error) {
  if (error instanceof NetworkError) {
    return navigator.onLine
      ? "Couldn't reach the weather service. Check your connection, and that your computer's date and time are correct."
      : "You appear to be offline. Reconnect to the internet and try again.";
  }
  if (error instanceof ApiError && error.status >= 500) {
    return "The weather service is having problems right now. Please try again in a few minutes.";
  }
  if (error instanceof ApiError) {
    return "The weather service couldn't handle that request. Please try a different search.";
  }
  return "Something went wrong while loading the weather. Please try again.";
}

// ===== API =====
// fetch() only fails on network problems. A 404 or 500 still "succeeds",
// so check response.ok and throw our own errors for both cases.
async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new NetworkError();
  }

  if (!response.ok) {
    // Open-Meteo explains errors as { error: true, reason: "..." }
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.reason);
  }

  return response.json();
}

// City name -> array of matching places (with latitude and longitude)
async function searchCities(name) {
  const params = new URLSearchParams({
    name,
    count: MAX_CITY_RESULTS,
    language: "en",
    format: "json",
  });

  const data = await fetchJson(`${GEOCODING_URL}?${params}`);

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

  return fetchJson(`${FORECAST_URL}?${params}`);
}

// ===== Weather codes =====
const UNKNOWN_WEATHER = { description: "Unknown conditions", icon: "🌡️" };

// Code -> { description, icon }, choosing the night icon when it's dark
function getWeatherInfo(code, isDay = true) {
  const info = WEATHER_CODES[code] ?? UNKNOWN_WEATHER;
  const icon = !isDay && info.nightIcon ? info.nightIcon : info.icon;
  return { description: info.description, icon };
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
// One place to show any message: plain, loading (spinner) or error (red)
function showStatus(message, { loading = false, error = false } = {}) {
  statusMessage.textContent = message;
  statusEl.classList.toggle("is-loading", loading);
  statusEl.classList.toggle("is-error", error);
  statusEl.hidden = false;
}

function hideResults() {
  currentSection.hidden = true;
}

function renderCurrentWeather(place, weather) {
  const { current, current_units: units } = weather;

  locationName.textContent = place.name;
  locationDetail.textContent = formatPlaceDetail(place);

  // The API sends is_day as 1 or 0, so turn it into true/false
  const { description, icon } = getWeatherInfo(current.weather_code, current.is_day === 1);
  currentIcon.textContent = icon;
  currentTemp.textContent = formatTemperature(current.temperature_2m);
  currentDescription.textContent = description;

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
  if (!query) {
    showStatus("Please type a city name first.");
    cityInput.focus();
    return;
  }

  hideResults();
  showStatus(`Searching for “${query}”…`, { loading: true });

  try {
    const cities = await searchCities(query);
    if (cities.length === 0) {
      showStatus(`No city called “${query}” was found. Check the spelling and try again.`);
      return;
    }

    // For now, use the best match (choosing between cities comes in Step 11)
    const place = cities[0];
    showStatus(`Loading the weather for ${place.name}…`, { loading: true });

    const weather = await fetchWeather(place.latitude, place.longitude);
    renderCurrentWeather(place, weather);
  } catch (error) {
    console.error(error); // full details for you, a friendly message for the user
    hideResults();
    showStatus(getErrorMessage(error), { error: true });
  }
}

// ===== Init =====
searchForm.addEventListener("submit", handleSearch);
