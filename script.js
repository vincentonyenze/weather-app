// ===== DOM elements =====
const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");

// ===== Config =====
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const MAX_CITY_RESULTS = 5;

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

// ===== Event handlers =====
async function handleSearch(event) {
  event.preventDefault();

  const query = cityInput.value.trim();
  if (!query) return;

  const cities = await searchCities(query);
  console.log(`Found ${cities.length} match(es) for "${query}":`, cities);
}

// ===== Init =====
searchForm.addEventListener("submit", handleSearch);
