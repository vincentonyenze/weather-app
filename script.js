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
const forecastSection = document.getElementById("forecast");
const forecastList = document.getElementById("forecast-list");
const cityChoices = document.getElementById("city-choices");
const cityList = document.getElementById("city-list");

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

const DAILY_FIELDS = ["weather_code", "temperature_2m_max", "temperature_2m_min"];
const FORECAST_DAYS = 7;

// ===== State =====
const state = {
  cityResults: [], // matches from the last search, shown as choices
};

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
    daily: DAILY_FIELDS.join(","),
    forecast_days: FORECAST_DAYS,
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

// 15388000 -> "15M", 540 -> "540"
const compactNumber = new Intl.NumberFormat("en", { notation: "compact" });

function formatPopulation(population) {
  return population ? `${compactNumber.format(population)} people` : "";
}

// "2026-10-17" -> "Sat". Built from parts so it isn't shifted by time zones.
function formatWeekday(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "short" });
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
  forecastSection.hidden = true;
  cityChoices.hidden = true;
}

function createCityOption(place, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "city-option";
  button.dataset.index = index;

  const name = document.createElement("span");
  name.className = "city-option__name";
  name.textContent = place.name;

  const detail = document.createElement("span");
  detail.className = "city-option__detail";
  detail.textContent = [formatPlaceDetail(place), formatPopulation(place.population)]
    .filter(Boolean)
    .join(" · ");

  button.append(name, detail);

  const item = document.createElement("li");
  item.append(button);
  return item;
}

function renderCityChoices(cities) {
  state.cityResults = cities;
  cityList.replaceChildren(...cities.map(createCityOption));

  statusEl.hidden = true;
  cityChoices.hidden = false;
  // Put keyboard users straight on the first option
  cityList.querySelector("button").focus();
}

// The API sends one array per value:
//   { time: ["2026-10-17", "2026-10-18"], temperature_2m_max: [31, 30], ... }
// It's easier to work with one object per day:
//   [{ date: "2026-10-17", max: 31, ... }, { date: "2026-10-18", max: 30, ... }]
function toDailyForecast(daily) {
  return daily.time.map((date, index) => ({
    date,
    code: daily.weather_code[index],
    max: daily.temperature_2m_max[index],
    min: daily.temperature_2m_min[index],
  }));
}

function createForecastItem(day, index) {
  const { description, icon } = getWeatherInfo(day.code);

  const item = document.createElement("li");
  item.className = "forecast-item";

  const dayName = document.createElement("span");
  dayName.className = "forecast-item__day";
  // The first day is today in the city's own time zone
  dayName.textContent = index === 0 ? "Today" : formatWeekday(day.date);

  const iconEl = document.createElement("span");
  iconEl.className = "forecast-item__icon";
  iconEl.setAttribute("aria-hidden", "true");
  iconEl.textContent = icon;

  const descriptionEl = document.createElement("span");
  descriptionEl.className = "forecast-item__description";
  descriptionEl.textContent = description;

  const temps = document.createElement("span");
  temps.className = "forecast-item__temps";

  const max = document.createElement("span");
  max.className = "forecast-item__max";
  max.textContent = formatTemperature(day.max);

  const min = document.createElement("span");
  min.className = "forecast-item__min";
  min.textContent = formatTemperature(day.min);

  temps.append(max, min);
  item.append(dayName, iconEl, descriptionEl, temps);
  return item;
}

function renderForecast(weather) {
  const days = toDailyForecast(weather.daily);
  forecastList.replaceChildren(...days.map(createForecastItem));
  forecastSection.hidden = false;
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

  let cities;
  try {
    cities = await searchCities(query);
  } catch (error) {
    showError(error);
    return;
  }

  if (cities.length === 0) {
    showStatus(`No city called “${query}” was found. Check the spelling and try again.`);
  } else if (cities.length === 1) {
    loadWeather(cities[0]);
  } else {
    renderCityChoices(cities);
  }
}

function handleCityChoice(event) {
  const button = event.target.closest(".city-option");
  if (!button) return;

  const place = state.cityResults[Number(button.dataset.index)];
  loadWeather(place);
}

// ===== Loading weather =====
async function loadWeather(place) {
  hideResults();
  showStatus(`Loading the weather for ${place.name}…`, { loading: true });

  try {
    const weather = await fetchWeather(place.latitude, place.longitude);
    renderCurrentWeather(place, weather);
    renderForecast(weather);
  } catch (error) {
    showError(error);
  }
}

function showError(error) {
  console.error(error); // full details for you, a friendly message for the user
  hideResults();
  showStatus(getErrorMessage(error), { error: true });
}

// ===== Init =====
searchForm.addEventListener("submit", handleSearch);
cityList.addEventListener("click", handleCityChoice);
