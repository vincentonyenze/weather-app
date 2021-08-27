// WMO weather interpretation codes, as used by the Open-Meteo API.
// nightIcon is optional: used when it's dark for codes where the sun would show.
const WEATHER_CODES = {
  0: { description: "Clear sky", icon: "☀️", nightIcon: "🌙" },
  1: { description: "Mainly clear", icon: "🌤️", nightIcon: "🌙" },
  2: { description: "Partly cloudy", icon: "⛅", nightIcon: "☁️" },
  3: { description: "Overcast", icon: "☁️" },

  45: { description: "Fog", icon: "🌫️" },
  48: { description: "Freezing fog", icon: "🌫️" },

  51: { description: "Light drizzle", icon: "🌦️", nightIcon: "🌧️" },
  53: { description: "Drizzle", icon: "🌦️", nightIcon: "🌧️" },
  55: { description: "Heavy drizzle", icon: "🌧️" },
  56: { description: "Light freezing drizzle", icon: "🌧️" },
  57: { description: "Freezing drizzle", icon: "🌧️" },

  61: { description: "Light rain", icon: "🌦️", nightIcon: "🌧️" },
  63: { description: "Rain", icon: "🌧️" },
  65: { description: "Heavy rain", icon: "🌧️" },
  66: { description: "Light freezing rain", icon: "🌧️" },
  67: { description: "Freezing rain", icon: "🌧️" },

  71: { description: "Light snow", icon: "🌨️" },
  73: { description: "Snow", icon: "🌨️" },
  75: { description: "Heavy snow", icon: "❄️" },
  77: { description: "Snow grains", icon: "🌨️" },

  80: { description: "Light showers", icon: "🌦️", nightIcon: "🌧️" },
  81: { description: "Showers", icon: "🌧️" },
  82: { description: "Violent showers", icon: "🌧️" },
  85: { description: "Light snow showers", icon: "🌨️" },
  86: { description: "Snow showers", icon: "🌨️" },

  95: { description: "Thunderstorm", icon: "⛈️" },
  96: { description: "Thunderstorm with hail", icon: "⛈️" },
  99: { description: "Thunderstorm with heavy hail", icon: "⛈️" },
};
