/* ============================================
   HOMAGAMA WEATHER PREDICTOR - JavaScript
   Fetches data, updates UI, handles animations
   ============================================ */

// --- CONFIGURATION ---
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast?latitude=6.844&longitude=80.003&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,precipitation_probability_max,windspeed_10m_max,relative_humidity_2m_max,uv_index_max,weathercode&hourly=temperature_2m,precipitation_probability,windspeed_10m,relative_humidity_2m&timezone=auto";

const resolveBackendUrl = () => {
    const hosted = "https://im45h4.pythonanywhere.com/predict";
    if (typeof window === "undefined") return hosted;
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
    return isLocal ? "http://127.0.0.1:5000/predict" : hosted;
};

const MY_API_URL = resolveBackendUrl();

document.addEventListener("DOMContentLoaded", () => {
    window.requestAnimationFrame(() => document.body.classList.add("page-ready"));
});

// --- DOM ELEMENTS ---
const predictButton = document.getElementById("predict-button");
const loadingDiv = document.getElementById("loading");
const errorDisplay = document.getElementById("error-display");
const errorMessage = document.getElementById("error-message");
const resultsDiv = document.getElementById("results");
const heroSection = document.querySelector(".hero-section");
const heroStatus = document.getElementById("hero-status");
const quickTemp = document.getElementById("quick-temp");
const quickRain = document.getElementById("quick-rain");
const quickUpdated = document.getElementById("quick-updated");
const scrollToHeroBtn = document.getElementById("scroll-to-hero");

if (scrollToHeroBtn) {
    scrollToHeroBtn.addEventListener("click", () => {
        document.getElementById("hero")?.scrollIntoView({ behavior: "smooth" });
    });
}

// --- HELPERS ---
const formatDegrees = (value, digits = 1) => {
    const num = Number(value);
    return Number.isFinite(num) ? `${num.toFixed(digits)}\u00B0C` : "--";
};

const formatPercent = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? `${Math.round(num)}%` : "--";
};

const formatMillimeters = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? `${num.toFixed(1)} mm` : "--";
};

const formatSpeed = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? `${num.toFixed(1)} km/h` : "--";
};

const formatUv = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num.toFixed(1) : "--";
};

const formatTime = (date) =>
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const announceStatus = (text) => {
    if (heroStatus) {
        heroStatus.textContent = text;
    }
};

const updateQuickStats = (temp, rain, date) => {
    if (quickTemp) quickTemp.textContent = formatDegrees(temp);
    if (quickRain) quickRain.textContent = formatPercent(rain);
    if (quickUpdated) quickUpdated.textContent = formatTime(date);
};

const updateHeroTheme = (rainChance) => {
    if (!heroSection) return;
    const theme = Number(rainChance) >= 60 ? "stormy" : "clear";
    heroSection.dataset.theme = theme;
};

// --- EVENT LISTENER ---
predictButton?.addEventListener("click", () => {
    announceStatus("Calculating the freshest forecast...");
    errorDisplay?.classList.add("hidden");
    resultsDiv?.classList.add("hidden");
    loadingDiv?.classList.remove("hidden");
    predictButton.disabled = true;
    getPrediction();
});

// --- MAIN PREDICTION WORKFLOW ---
async function getPrediction() {
    try {
        console.log("Fetching meteorological data from Open-Meteo...");
        const response1 = await fetch(OPEN_METEO_URL);
        if (!response1.ok) {
            throw new Error(`API Error: ${response1.statusText}`);
        }
        const weatherData = await response1.json();
        console.log("Weather data received", weatherData);

        const today = weatherData.daily;
        const tmax = today.temperature_2m_max[0];
        const tmin = today.temperature_2m_min[0];
        const prcp = today.precipitation_sum[0];

        const getDayOfYear = (date) => {
            const start = new Date(date.getFullYear(), 0, 0);
            const diff = date - start;
            const oneDay = 1000 * 60 * 60 * 24;
            return Math.floor(diff / oneDay);
        };

        const todayDate = new Date(today.time[0]);
        const hourly = weatherData.hourly;
        const hourlyTemps = hourly.temperature_2m.slice(0, 24);
        const hourlyRainProb = hourly.precipitation_probability.slice(0, 24);
        const hourlyWind = hourly.windspeed_10m.slice(0, 24);
        const hourlyHumidity = hourly.relative_humidity_2m.slice(0, 24);

        const features = {
            tavg: (tmax + tmin) / 2,
            tmin,
            tmax,
            prcp,
            temp_range: tmax - tmin,
            month: todayDate.getMonth() + 1,
            day_of_year: getDayOfYear(todayDate),
            hourly_temps: hourlyTemps,
            hourly_rain_prob: hourlyRainProb,
            hourly_wind: hourlyWind,
            hourly_humidity: hourlyHumidity
        };

        console.log("Sending features to ML model", features);
        const response2 = await fetch(MY_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(features)
        });

        if (!response2.ok) {
            throw new Error(`Backend Error: ${response2.statusText}`);
        }
        const prediction = await response2.json();
        console.log("Predictions received", prediction);
        displayResults(prediction, weatherData, todayDate);
    } catch (error) {
        console.error("Prediction pipeline failed", error);
        showError(error.message || "Could not retrieve predictions. Please try again.");
    } finally {
        if (predictButton) {
            predictButton.disabled = false;
        }
        loadingDiv?.classList.add("hidden");
    }
}

// --- DISPLAY RESULTS ---
function displayResults(prediction, weatherData, todayDate) {
    if (!resultsDiv) return;

    const predictedTemp = Number(prediction.predicted_temp);
    const predictedRain = Number(prediction.predicted_rain_chance);
    const todayData = prediction.today_data || {};
    const daily = weatherData.daily;

    document.getElementById("pred-temp").textContent = formatDegrees(predictedTemp);
    document.getElementById("pred-rain").textContent = formatPercent(predictedRain);

    document.getElementById("today-tmax").textContent = formatDegrees(todayData.temp_max);
    document.getElementById("today-tmin").textContent = formatDegrees(todayData.temp_min);
    document.getElementById("today-tavg").textContent = formatDegrees(todayData.temp_avg);
    document.getElementById("today-prcp").textContent = formatMillimeters(todayData.precipitation);

    document.getElementById("api-lat").textContent = "6.844\u00B0N";
    document.getElementById("api-lon").textContent = "80.003\u00B0E";
    document.getElementById("api-temp").textContent = formatDegrees(daily.temperature_2m_mean[0]);
    document.getElementById("api-date").textContent = todayDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });

    document.getElementById("atmo-wind").textContent = formatSpeed(daily.windspeed_10m_max[0]);
    document.getElementById("atmo-humidity").textContent = formatPercent(daily.relative_humidity_2m_max[0]);
    document.getElementById("atmo-uv").textContent = formatUv(daily.uv_index_max[0]);
    document.getElementById("atmo-rain-prob").textContent = formatPercent(daily.precipitation_probability_max[0]);

    displayHourlyData(weatherData);
    const updatedAt = new Date();
    updateQuickStats(predictedTemp, predictedRain, updatedAt);
    updateHeroTheme(predictedRain);
    announceStatus(`Updated ${updatedAt.toLocaleDateString("en-US", { weekday: "short" })} at ${formatTime(updatedAt)}`);

    errorDisplay?.classList.add("hidden");
    resultsDiv.classList.remove("hidden");
}

// --- HOURLY DATA ---
function displayHourlyData(weatherData) {
    const hourly = weatherData.hourly;
    const times = hourly.time;
    const hourlyContainer = document.getElementById("hourly-data");
    if (!hourlyContainer) return;

    hourlyContainer.innerHTML = "";
    const hours = Math.min(24, times.length);

    for (let i = 0; i < hours; i++) {
        const time = new Date(times[i]);
        const hour = time.getHours().toString().padStart(2, "0") + ":00";
        const temp = hourly.temperature_2m[i];
        const precip = hourly.precipitation_probability[i];
        const wind = hourly.windspeed_10m[i];
        const humidity = hourly.relative_humidity_2m[i];

        const hourlyItem = document.createElement("article");
        hourlyItem.className = "hourly-item";
        hourlyItem.innerHTML = `
            <div class="hourly-time">${hour}</div>
            <div class="hourly-temp">${formatDegrees(temp)}</div>
            <div class="hourly-details">
                <span class="hourly-label">Rain</span>
                <span>${formatPercent(precip)}</span>
            </div>
            <div class="hourly-details">
                <span class="hourly-label">Wind</span>
                <span>${formatSpeed(wind)}</span>
            </div>
            <div class="hourly-details">
                <span class="hourly-label">Humidity</span>
                <span>${formatPercent(humidity)}</span>
            </div>
        `;
        hourlyContainer.appendChild(hourlyItem);
    }
}

// --- ERROR HANDLING ---
function showError(message) {
    if (errorMessage) {
        errorMessage.textContent = message;
    }
    errorDisplay?.classList.remove("hidden");
    resultsDiv?.classList.add("hidden");
    announceStatus("Unable to load weather data right now.");
}
