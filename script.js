// ===== DOM elements =====
const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const locationBtn = document.getElementById("location-btn");
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
const unitsEl = document.querySelector(".units");
const unitButtons = document.querySelectorAll(".unit-btn");

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

// The API's own unit names for each choice
const UNIT_PARAMS = {
  celsius: { temperature_unit: "celsius", wind_speed_unit: "kmh" },
  fahrenheit: { temperature_unit: "fahrenheit", wind_speed_unit: "mph" },
};

const STORAGE_KEY = "weather-app:preferences";

// ===== State =====
const state = {
  cityResults: [], // matches from the last search, shown as choices
  currentPlace: null, // the place whose weather is showing
  unit: "celsius", // "celsius" | "fahrenheit"
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

// The browser couldn't give us the user's location
class LocationError extends Error {
  constructor(reason) {
    super(`Location unavailable: ${reason}`);
    this.name = "LocationError";
    this.reason = reason; // "denied" | "unavailable" | "timeout" | "unsupported"
  }
}

const LOCATION_ERROR_MESSAGES = {
  denied:
    "Location access is blocked. Allow it in your browser's site settings, or search for a city instead.",
  unavailable: "Your location couldn't be found. Try searching for a city instead.",
  timeout: "Finding your location took too long. Please try again.",
  unsupported: "This browser can't share your location. Search for a city instead.",
};

// Turn any error into a message a user can act on
function getErrorMessage(error) {
  if (error instanceof LocationError) {
    return LOCATION_ERROR_MESSAGES[error.reason];
  }
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

// Coordinates -> weather data, in the chosen units
async function fetchWeather(latitude, longitude, unit) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    ...UNIT_PARAMS[unit],
    current: CURRENT_FIELDS.join(","),
    daily: DAILY_FIELDS.join(","),
    forecast_days: FORECAST_DAYS,
    timezone: "auto", // times come back in the city's own time zone
  });

  return fetchJson(`${FORECAST_URL}?${params}`);
}

// ===== Storage =====
// Saved as: { unit: "celsius", lastPlace: { name, latitude, longitude, ... } }

function isValidPlace(place) {
  return (
    Boolean(place) &&
    typeof place.name === "string" &&
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude) &&
    Math.abs(place.latitude) <= 90 &&
    Math.abs(place.longitude) <= 180
  );
}

function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return {};

    // Only keep values we can trust
    return {
      // hasOwn, not `in`: "toString" in UNIT_PARAMS is true (inherited)
      unit: Object.hasOwn(UNIT_PARAMS, saved.unit) ? saved.unit : undefined,
      lastPlace: isValidPlace(saved.lastPlace) ? saved.lastPlace : undefined,
    };
  } catch (error) {
    console.error("Could not load preferences:", error);
    return {};
  }
}

// Merge new values into what's already saved
function savePreferences(updates) {
  try {
    const next = { ...loadPreferences(), ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("Could not save preferences:", error);
  }
}

// Keep only what's needed to load the place again
function toSavedPlace(place) {
  const { name, admin1, country, detail, latitude, longitude } = place;
  return { name, admin1, country, detail, latitude, longitude };
}

// ===== Geolocation =====
// The browser's numeric error codes, as words
const GEOLOCATION_ERRORS = {
  1: "denied", // PERMISSION_DENIED
  2: "unavailable", // POSITION_UNAVAILABLE
  3: "timeout", // TIMEOUT
};

// getCurrentPosition() uses callbacks, not promises.
// Wrapping it in a Promise lets us use it with await like fetch().
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new LocationError("unsupported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => reject(new LocationError(GEOLOCATION_ERRORS[error.code] ?? "unavailable")),
      {
        timeout: 10_000, // give up after 10 seconds
        maximumAge: 10 * 60 * 1000, // a position from the last 10 minutes is fine
      }
    );
  });
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

// "Lagos, Nigeria" -- skipping any part the API didn't send.
// Places we made ourselves (like "Your location") bring their own detail.
function formatPlaceDetail(place) {
  return place.detail ?? [place.admin1, place.country].filter(Boolean).join(", ");
}

// (6.4541, 3.3947) -> "6.45°N, 3.39°E"
function formatCoordinates(latitude, longitude) {
  const lat = `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
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

function renderUnitButtons() {
  unitButtons.forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.unit === state.unit);
  });
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
  // The API writes miles per hour as "mp/h"; "mph" is what people expect
  const windUnit = units.wind_speed_10m.replace("mp/h", "mph");
  wind.textContent = `${Math.round(current.wind_speed_10m)} ${windUnit}`;
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

async function handleLocationClick() {
  hideResults();
  showStatus("Finding your location…", { loading: true });

  try {
    const position = await getCurrentPosition();
    const { latitude, longitude } = position.coords;

    // The API can't turn coordinates back into a city name,
    // so describe the place ourselves
    loadWeather({
      name: "Your location",
      detail: formatCoordinates(latitude, longitude),
      latitude,
      longitude,
    });
  } catch (error) {
    showError(error);
  }
}

function handleUnitClick(event) {
  const button = event.target.closest(".unit-btn");
  if (!button || button.dataset.unit === state.unit) return;

  state.unit = button.dataset.unit;
  renderUnitButtons();
  savePreferences({ unit: state.unit });

  // Reload the city that's showing, in the new units
  if (state.currentPlace) {
    loadWeather(state.currentPlace);
  }
}

// ===== Loading weather =====
async function loadWeather(place) {
  state.currentPlace = place;
  hideResults();
  showStatus(`Loading the weather for ${place.name}…`, { loading: true });

  try {
    const weather = await fetchWeather(place.latitude, place.longitude, state.unit);
    renderCurrentWeather(place, weather);
    renderForecast(weather);
    // Only remember places that actually loaded
    savePreferences({ lastPlace: toSavedPlace(place) });
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
locationBtn.addEventListener("click", handleLocationClick);
unitsEl.addEventListener("click", handleUnitClick);

const preferences = loadPreferences();
state.unit = preferences.unit ?? state.unit;
renderUnitButtons();

// Welcome back: show the last city straight away
if (preferences.lastPlace) {
  loadWeather(preferences.lastPlace);
}
