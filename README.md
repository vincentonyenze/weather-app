# Weather App

A weather app that shows the current weather and a 7-day forecast for any city, built with plain HTML, CSS and JavaScript. No frameworks or libraries.

This is **Project 6** in my beginner-to-expert web development roadmap, and the first one that talks to a real API.

<!-- Add a screenshot: save one as screenshot.png in this folder and uncomment the line below -->
<!-- ![Weather App screenshot](screenshot.png) -->

## Features

- Search any city in the world
- Choose between cities with the same name (shows region, country and population)
- Current weather: temperature, feels like, humidity, wind, description and icon (with night icons)
- 7-day forecast with daily highs and lows
- °C / °F toggle (wind switches between km/h and mph)
- 📍 Weather for your current location
- Remembers your last city and unit between visits
- Clear loading, empty and error states, with messages for each kind of problem (offline, server error, location blocked, and more)
- Outdated requests are cancelled, so a slow reply can never overwrite a newer one
- Keyboard and screen-reader friendly
- Responsive layout for desktop and phone

## Built with

- HTML5 (`role="search"`, description lists, live regions)
- CSS3 (custom properties, Flexbox, Grid, a pure-CSS spinner, `prefers-reduced-motion`)
- Vanilla JavaScript (ES6+)
- [Open-Meteo](https://open-meteo.com/) Geocoding and Forecast APIs (free, no API key)
- Browser APIs: `fetch`, `AbortController`, Geolocation, `localStorage`

## How it works

1. **Search:** the city name goes to the Geocoding API, which returns matching places with their coordinates.
2. **Choose:** one match loads straight away; several matches are shown as choices.
3. **Weather:** the coordinates go to the Forecast API, which returns the current weather and 7 days of data in one request.
4. **Display:** weather codes are turned into words and icons, and the daily data is reshaped into one object per day.

## What I learned

- **Asynchronous JavaScript:** promises, `async`/`await`, and chaining requests that depend on each other
- **`fetch()` and HTTP:** `response.ok`, status codes, and why `fetch` doesn't throw on a 404 or 500
- **Error handling:** custom error classes (`NetworkError`, `ApiError`, `LocationError`) and turning each one into a helpful message
- **UI states:** start, loading, choosing, success, empty and error, with every path ending in a visible state
- **Working with API data:** `URLSearchParams`, `??`, `filter(Boolean)`, reshaping column-oriented data, and cleaning values at the edges
- **Wrapping callback APIs in a Promise** so they work with `await` (Geolocation)
- **Race conditions,** and fixing them with `AbortController` and `signal.aborted`
- **Defensive storage:** validating everything read from `localStorage` (and why `Object.hasOwn` is safer than `in`)
- **Debugging with DevTools:** the Network tab, throttling, request blocking and sensor overrides

## How to run

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   ```
2. Open `index.html` in your browser.

No installation, build step or API key is needed.

**Notes:**

- Your computer's date and time must be correct. HTTPS requests fail if the clock is far off.
- Some browsers don't allow location access on pages opened from a local file (`file://`). If 📍 doesn't work, use a local server (for example the Live Server extension in VS Code) or the deployed GitHub Pages version.

## Project structure

```
weather-app/
├── index.html         # Search, city choices, status, current weather, forecast
├── style.css          # Layout, cards, spinner, states, responsive design
├── weather-codes.js   # WMO weather codes -> descriptions and icons
├── script.js          # State, API requests, errors, rendering, storage
└── README.md
```

## Known limitations

- "Your location" shows coordinates instead of a city name, because the API can't look up a name from coordinates.
- On Windows, some weather emoji may look different from other systems.

## Possible improvements

- Hourly forecast for today
- Search suggestions while typing (with debouncing)
- A list of saved favourite cities
- Background that changes with the weather and time of day
- Rebuild in React (planned for a later project in my roadmap)

## Credits

Weather data by [Open-Meteo](https://open-meteo.com/), licensed under CC BY 4.0.
