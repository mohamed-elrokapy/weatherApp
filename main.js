(function () {
  const form = document.getElementById("search");
  const input = document.getElementById("city");
  const submitBtn = document.getElementById("submit");
  const cityError = document.getElementById("city-error");
  const card = document.getElementById("card");
  const cardBody = document.getElementById("card-body");

  const API_KEY = typeof OPENWEATHER_API_KEY === "string" ? OPENWEATHER_API_KEY.trim() : "";
  const FETCH_TIMEOUT_MS = 10000;
  const STORAGE_KEY = "weather-app:last-city";

  // ---- Icons (inline SVG, no network) -------------------------------------
  const S = 'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
  const SUN = (cx, cy, r) => {
    let rays = "";
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const x1 = cx + Math.cos(a) * (r + 5), y1 = cy + Math.sin(a) * (r + 5);
      const x2 = cx + Math.cos(a) * (r + 10), y2 = cy + Math.sin(a) * (r + 10);
      rays += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
    }
    return `<circle cx="${cx}" cy="${cy}" r="${r}"/>${rays}`;
  };
  const MOON = `<path d="M44 38a16 16 0 1 1-18-24 13 13 0 0 0 18 24z"/>`;
  const CLOUD = (dx = 0, dy = 0) =>
    `<path transform="translate(${dx} ${dy})" d="M20 46h26a10 10 0 0 0 1.5-19.9A14 14 0 0 0 20.5 28 9 9 0 0 0 20 46z"/>`;
  const ICONS = {
    "clear-day": SUN(32, 32, 10),
    "clear-night": MOON,
    "partly-day": SUN(24, 24, 7) + CLOUD(4, 8),
    "partly-night": `<path transform="scale(.6) translate(-2 -2)" d="M44 38a16 16 0 1 1-18-24 13 13 0 0 0 18 24z"/>` + CLOUD(4, 8),
    clouds: CLOUD(0, -2),
    rain: CLOUD(0, -8) + `<path d="M22 50l-3 7M32 50l-3 7M42 50l-3 7"/>`,
    storm: CLOUD(0, -8) + `<path d="M33 40l-6 9h8l-5 9"/>`,
    snow: CLOUD(0, -8) + `<path d="M22 52h.01M32 55h.01M42 52h.01M27 58h.01M37 58h.01"/>`,
    mist: `<path d="M12 24h40M8 34h40M16 44h40"/>`,
  };

  // Map an OpenWeather condition id and icon code to an icon and a sky theme.
  function describeSky(id, iconCode) {
    const night = typeof iconCode === "string" && iconCode.endsWith("n");
    if (id >= 200 && id < 300) return { icon: "storm", sky: "storm" };
    if (id >= 300 && id < 400) return { icon: "rain", sky: "rain" };
    if (id >= 500 && id < 600) return { icon: "rain", sky: "rain" };
    if (id >= 600 && id < 700) return { icon: "snow", sky: "snow" };
    if (id >= 700 && id < 800) return { icon: "mist", sky: "mist" };
    if (id === 800) return { icon: night ? "clear-night" : "clear-day", sky: night ? "clear-night" : "clear-day" };
    if (id === 801 || id === 802) return { icon: night ? "partly-night" : "partly-day", sky: night ? "clouds-night" : "clouds-day" };
    return { icon: "clouds", sky: night ? "clouds-night" : "clouds-day" };
  }

  function iconSvg(name) {
    return `<svg class="icon" viewBox="0 0 64 64" width="96" height="96" aria-hidden="true" focusable="false" ${S}>${ICONS[name] || ICONS.clouds}</svg>`;
  }

  // ---- Small helpers -------------------------------------------------------
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function setState(state) {
    if (state !== "ready") document.title = "Weather";
    card.dataset.state = state;
    card.setAttribute("aria-busy", String(state === "loading"));
  }

  function setSky(sky) {
    document.body.dataset.sky = sky;
  }

  const countryNames = (() => {
    try {
      return new Intl.DisplayNames(undefined, { type: "region" });
    } catch (e) {
      return null;
    }
  })();
  function countryName(code) {
    if (!code) return "";
    try {
      return (countryNames && countryNames.of(code)) || code;
    } catch (e) {
      return code;
    }
  }

  // The city's current local time, from the UTC offset OpenWeather returns.
  function localTimeAt(offsetSeconds) {
    const shifted = new Date(Date.now() + offsetSeconds * 1000);
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(shifted);
  }

  const number = (n, digits = 0) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(n);

  // ---- Views ---------------------------------------------------------------
  let clockTimer = null;
  function stopClock() {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = null;
  }

  function showIdle() {
    stopClock();
    setState("idle");
    setSky("idle");
    if (!API_KEY) {
      showSetup();
      return;
    }
    cardBody.replaceChildren(
      el("p", "message-title", "Search for a city"),
      el("p", "message-text", "Type a city name above to see its current weather.")
    );
  }

  function showSetup() {
    setState("error");
    setSky("idle");
    cardBody.replaceChildren(
      el("p", "message-title", "API key needed"),
      el("p", "message-text", "This app needs a free OpenWeather API key. Add it to config.js as OPENWEATHER_API_KEY, then reload. The README has the steps.")
    );
  }

  function showLoading(city) {
    stopClock();
    setState("loading");
    cardBody.replaceChildren(el("p", "message-title", `Looking up ${city}...`), el("div", "skeleton"));
  }

  function showError(title, text) {
    stopClock();
    setState("error");
    setSky("idle");
    cardBody.replaceChildren(el("p", "message-title", title), el("p", "message-text", text));
  }

  function showWeather(data) {
    const condition = (data.weather && data.weather[0]) || {};
    const { icon, sky } = describeSky(condition.id, condition.icon);
    setState("ready");
    setSky(sky);

    const place = [data.name, countryName(data.sys && data.sys.country)].filter(Boolean).join(", ");
    const header = el("div", "place");
    header.append(el("h2", "place-name", place || "Unknown place"));
    const time = el("p", "place-time");
    const tz = typeof data.timezone === "number" ? data.timezone : null;
    if (tz !== null) {
      const update = () => (time.textContent = `Local time: ${localTimeAt(tz)}`);
      update();
      stopClock();
      clockTimer = setInterval(update, 30000);
    }
    header.append(time);

    const hero = el("div", "hero");
    hero.insertAdjacentHTML("beforeend", iconSvg(icon));
    const temp = el("p", "temp", `${number(data.main.temp)}°C`);
    const desc = el("p", "desc", condition.description || "");
    const heroText = el("div", "hero-text");
    heroText.append(temp, desc);
    hero.append(heroText);

    const details = el("dl", "details");
    const add = (label, value) => {
      const box = el("div", "detail");
      box.append(el("dt", "", label), el("dd", "", value));
      details.append(box);
    };
    if (data.main.feels_like !== undefined) add("Feels like", `${number(data.main.feels_like)}°C`);
    if (data.wind && data.wind.speed !== undefined) add("Wind", `${number(data.wind.speed, 1)} m/s`);
    if (data.main.humidity !== undefined) add("Humidity", `${number(data.main.humidity)}%`);
    if (data.main.pressure !== undefined) add("Pressure", `${number(data.main.pressure)} hPa`);

    cardBody.replaceChildren(header, hero, details);
    document.title = `${number(data.main.temp)}°C in ${data.name || "your city"} · Weather`;
  }

  // ---- Fetching ------------------------------------------------------------
  let controller = null;
  let runId = 0;

  async function search(rawCity) {
    const city = rawCity.trim();
    if (!city) {
      cityError.textContent = "Enter a city name.";
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    cityError.textContent = "";
    input.removeAttribute("aria-invalid");

    if (!API_KEY) {
      showSetup();
      return;
    }

    if (controller) controller.abort();
    controller = new AbortController();
    const myRun = ++runId;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, FETCH_TIMEOUT_MS);

    showLoading(city);
    submitBtn.disabled = true;

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${encodeURIComponent(API_KEY)}`;
      const response = await fetch(url, { signal: controller.signal });
      let data = null;
      try {
        data = await response.json();
      } catch (e) {
        /* non-JSON body, handled by status below */
      }
      if (myRun !== runId) return;

      if (response.status === 404) {
        showError("City not found", `No match for "${city}". Check the spelling, or add a country code, for example "Cairo,EG".`);
      } else if (response.status === 401) {
        showError("API key rejected", "OpenWeather did not accept the key in config.js. New keys can take a couple of hours to activate.");
      } else if (response.status === 429) {
        showError("Too many requests", "The free OpenWeather plan limit was reached. Wait a minute and try again.");
      } else if (!response.ok || !data || !data.main) {
        showError("Weather unavailable", "The weather service returned an unexpected answer. Please try again.");
      } else {
        showWeather(data);
        try {
          localStorage.setItem(STORAGE_KEY, city);
        } catch (e) {
          /* ignore blocked storage */
        }
      }
    } catch (err) {
      if (myRun !== runId) return;
      if (err.name === "AbortError" && timedOut) {
        showError("Request timed out", "The weather service took too long to answer. Please try again.");
      } else if (err.name !== "AbortError") {
        showError("Could not reach the weather service", "Check your internet connection and try again.");
      }
    } finally {
      clearTimeout(timeout);
      if (myRun === runId) submitBtn.disabled = false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    search(input.value);
  });
  input.addEventListener("input", () => {
    if (cityError.textContent) {
      cityError.textContent = "";
      input.removeAttribute("aria-invalid");
    }
  });

  // ---- Start ---------------------------------------------------------------
  let last = "";
  try {
    last = localStorage.getItem(STORAGE_KEY) || "";
  } catch (e) {
    /* ignore */
  }
  showIdle();
  if (API_KEY && last) {
    input.value = last;
    search(last);
  }
})();
