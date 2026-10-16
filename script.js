const $ = (id) => document.getElementById(id);

const weatherDescriptions = {
  0: ["Clear sky", "☀️"], 1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"], 45: ["Foggy", "🌫️"], 48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"], 57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"], 67: ["Heavy freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"], 77: ["Snow grains", "🌨️"],
  80: ["Rain showers", "🌦️"], 81: ["Rain showers", "🌧️"], 82: ["Heavy showers", "⛈️"],
  85: ["Snow showers", "🌨️"], 86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm with hail", "⛈️"], 99: ["Thunderstorm with hail", "⛈️"]
};

function describe(code) {
  return weatherDescriptions[code] || ["Weather conditions", "🌤️"];
}

function showStatus(message, isError = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", isError);
}

function formatHour(isoTime) {
  // Treat the API's local time as UTC to display the exact wall-clock time.
  return new Date(isoTime + "Z").toLocaleTimeString([], { hour: "numeric", timeZone: "UTC" });
}

function formatLocalTime(isoTime) {
  const date = new Date(isoTime + "Z");
  return date.toLocaleString([], {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC"
  });
}

async function getCoordinates(city) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({ name: city, count: "1", language: "en", format: "json" });
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not search for that city. Please try again.");
  const data = await response.json();
  if (!data.results || data.results.length === 0) throw new Error("City not found. Check the spelling and try again.");
  return data.results[0];
}

async function getWeather(latitude, longitude, placeName, timezone = "auto") {
  showStatus("Getting the latest forecast…");
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude,
    longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,cloud_cover,pressure_msl,wind_speed_10m",
    hourly: "temperature_2m,weather_code",
    forecast_days: "2",
    timezone
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error("Weather data is temporarily unavailable. Please try again.");
  const data = await response.json();
  if (!data.current || !data.hourly) throw new Error("The weather service returned incomplete data.");

  const current = data.current;
  const [condition, emoji] = describe(current.weather_code);
  $("placeName").textContent = placeName;
  $("localTime").textContent = formatLocalTime(current.time);
  $("condition").textContent = condition;
  $("temperature").textContent = `${Math.round(current.temperature_2m)}°`;
  $("weatherEmoji").textContent = emoji;
  $("feelsLike").textContent = `${Math.round(current.apparent_temperature)}°C`;
  $("humidity").textContent = `${current.relative_humidity_2m}%`;
  $("wind").textContent = `${Math.round(current.wind_speed_10m)} km/h`;
  $("cloud").textContent = `${current.cloud_cover}%`;
  $("pressure").textContent = `${Math.round(current.pressure_msl)} hPa`;

  renderHourly(data.hourly, current.time);
  $("weatherPanel").hidden = false;
  showStatus("Weather updated successfully.");
}

function renderHourly(hourly, currentTime) {
  const container = $("hourlyForecast");
  container.innerHTML = "";

  // Find the start of the current hour (e.g., "2024-05-20T14:00")
  const currentHour = currentTime.slice(0, 13) + ":00";
  let startIndex = hourly.time.findIndex(time => time === currentHour);
  if (startIndex < 0) startIndex = 0;

  hourly.time.slice(startIndex, startIndex + 6).forEach((time, offset) => {
    const index = startIndex + offset;
    const [label, emoji] = describe(hourly.weather_code[index]);
    const card = document.createElement("article");
    card.className = "hour-card";

    const hour = document.createElement("p");
    hour.className = "hour";
    hour.textContent = offset === 0 ? "Now" : formatHour(time);

    const icon = document.createElement("div");
    icon.className = "icon";
    icon.textContent = emoji;
    icon.setAttribute("aria-label", label);

    const temp = document.createElement("p");
    temp.className = "temp";
    temp.textContent = `${Math.round(hourly.temperature_2m[index])}°`;

    card.append(hour, icon, temp);
    container.appendChild(card);
  });
}

$("searchForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const city = $("cityInput").value.trim();
  if (!city) return;
  $("weatherPanel").hidden = true;
  showStatus("Searching for your city…");
  $("searchForm").querySelector("button").disabled = true;
  try {
    const location = await getCoordinates(city);
    const label = [location.name, location.admin1, location.country].filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index).join(", ");
    await getWeather(location.latitude, location.longitude, label, location.timezone || "auto");
  } catch (error) {
    showStatus(error.message || "Something went wrong. Please try again.", true);
  } finally {
    $("searchForm").querySelector("button").disabled = false;
  }
});

$("locationBtn").addEventListener("click", () => {
  const btn = $("locationBtn");
  if (!navigator.geolocation) {
    showStatus("Location is not supported by this browser. Search for a city instead.", true);
    return;
  }
  btn.disabled = true;
  showStatus("Requesting your location permission…");
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        $("weatherPanel").hidden = true;
        await getWeather(position.coords.latitude, position.coords.longitude, "Your current location");
      } catch (error) {
        showStatus(error.message || "Could not load weather for your location.", true);
      } finally {
        btn.disabled = false;
      }
    },
    (error) => {
      const message = error.code === 1
        ? "Location permission was denied. You can search for a city instead."
        : "Could not get your location. Check your GPS or search for a city.";
      showStatus(message, true);
      btn.disabled = false;
    },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
  );
});

// Start with a useful example location; the user can search for any city.
getCoordinates("Mumbai").then(location => {
  const label = [location.name, location.admin1, location.country].filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index).join(", ");
  return getWeather(location.latitude, location.longitude, label, location.timezone || "auto");
}).catch(error => showStatus(error.message || "Enter a city to get the weather.", true));