<template>
  <div class="job-map-container">
    <!-- Map Header / Filter Controls -->
    <div class="map-controls">
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search companies (e.g. Google, Amazon)..."
          class="search-input"
        />
      </div>

      <div class="filter-actions">
        <label class="radius-label">
          Radius:
          <select v-model="selectedRadius" @change="fetchCompanies" class="radius-select">
            <option :value="10">10 km</option>
            <option :value="25">25 km</option>
            <option :value="50">50 km</option>
            <option :value="100">100 km</option>
            <option :value="0">All Companies</option>
          </select>
        </label>

        <button @click="locateUser" :disabled="locating" class="locate-btn" title="Center on my location">
          <span v-if="locating">📍 Locating...</span>
          <span v-else>🎯 My Location</span>
        </button>
      </div>
    </div>

    <!-- Status & Notification Notice -->
    <div v-if="noticeMessage" class="map-notice" :class="noticeType">
      <span>{{ noticeMessage }}</span>
      <button @click="noticeMessage = ''" class="close-notice-btn">✕</button>
    </div>

    <!-- Leaflet Map Container -->
    <div ref="mapContainer" class="leaflet-map-element"></div>

    <!-- Map Footer Info -->
    <div class="map-footer">
      <span>Showing <strong>{{ filteredCompanies.length }}</strong> company locations</span>
      <span v-if="userCoords">📍 Centered near your coordinates ({{ userCoords.lat.toFixed(3) }}, {{ userCoords.lng.toFixed(3) }})</span>
      <span v-else>🌐 Displaying global hub</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import axios from "axios";
import { useAuthStore } from "../store/auth.js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix standard Leaflet default marker assets in Vite
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

const authStore = useAuthStore();
const mapContainer = ref(null);
let map = null;
let markersLayer = null;
let userMarker = null;

const companies = ref([]);
const searchQuery = ref("");
const selectedRadius = ref(50);
const locating = ref(false);
const userCoords = ref(null);
const noticeMessage = ref("");
const noticeType = ref("info");

// Default center: Bengaluru Tech Hub (12.9716, 77.5946)
const DEFAULT_CENTER = [12.9716, 77.5946];
const DEFAULT_ZOOM = 12;

// Custom pulsing icon for user position
const userLocationIcon = L.divIcon({
  className: "custom-user-marker",
  html: `<div class="user-pulse-dot"></div><div class="user-pulse-ring"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Custom company pin icon
const createCompanyIcon = (name) => {
  return L.divIcon({
    className: "custom-company-marker",
    html: `<div class="company-pin"><span class="pin-badge">💼</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -32],
  });
};

const filteredCompanies = computed(() => {
  if (!searchQuery.value.trim()) return companies.value;
  const q = searchQuery.value.toLowerCase().trim();
  return companies.value.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.address && c.address.toLowerCase().includes(q))
  );
});

// Fetch companies from /api/companies/nearby or /api/companies
const fetchCompanies = async () => {
  try {
    let url = `${authStore.apiBaseUrl}/companies`;
    const params = {};

    if (userCoords.value && selectedRadius.value > 0) {
      url = `${authStore.apiBaseUrl}/companies/nearby`;
      params.lat = userCoords.value.lat;
      params.lng = userCoords.value.lng;
      params.radius = selectedRadius.value;
    }

    const res = await axios.get(url, { params });
    if (res.data.success) {
      companies.value = res.data.data || [];
      renderMarkers();
    }
  } catch (err) {
    console.error("Failed to fetch companies:", err);
    noticeMessage.value = "Failed to load company markers from backend.";
    noticeType.value = "error";
  }
};

// Render pins on Leaflet map
const renderMarkers = () => {
  if (!map || !markersLayer) return;

  markersLayer.clearLayers();

  const bounds = L.latLngBounds();

  filteredCompanies.value.forEach((comp) => {
    if (comp.lat == null || comp.lng == null) return;

    const latLng = [comp.lat, comp.lng];
    bounds.extend(latLng);

    const marker = L.marker(latLng, {
      icon: createCompanyIcon(comp.name),
    });

    const jobsHtml =
      comp.jobs && comp.jobs.length > 0
        ? `<div class="popup-jobs-list">
             <div class="popup-jobs-title">Open Positions (${comp.jobs.length}):</div>
             ${comp.jobs
               .slice(0, 3)
               .map(
                 (j) =>
                   `<div class="popup-job-item">
                      <span class="job-bullet">•</span>
                      <a href="${j.applyLink || comp.careerPageUrl}" target="_blank" rel="noopener noreferrer" class="popup-job-link">
                        ${j.title}
                      </a>
                    </div>`
               )
               .join("")}
           </div>`
        : "";

    const distanceBadge =
      comp.distanceKm != null
        ? `<span class="popup-distance">📍 ${comp.distanceKm} km away</span>`
        : "";

    const logoImg = comp.logo
      ? `<img src="${comp.logo}" alt="${comp.name}" class="popup-logo" onerror="this.style.display='none'" />`
      : "";

    const popupContent = `
      <div class="custom-popup-card">
        <div class="popup-header">
          ${logoImg}
          <div>
            <h3 class="popup-company-name">${comp.name}</h3>
            ${distanceBadge}
          </div>
        </div>
        <p class="popup-address">${comp.address || ""}</p>
        ${jobsHtml}
        <div class="popup-actions">
          <a
            href="${comp.careerPageUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="popup-apply-btn"
          >
            Apply & View Careers →
          </a>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, {
      maxWidth: 320,
      className: "job-leaflet-popup",
    });

    markersLayer.addLayer(marker);
  });

  // Fit bounds if markers exist and not manually zoomed
  if (filteredCompanies.value.length > 0 && !userCoords.value) {
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }
};

// Geolocation function
const locateUser = () => {
  if (!navigator.geolocation) {
    noticeMessage.value = "Geolocation is not supported by your browser.";
    noticeType.value = "warning";
    return;
  }

  locating.value = true;
  noticeMessage.value = "Detecting your location...";
  noticeType.value = "info";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      locating.value = false;
      const { latitude, longitude } = position.coords;
      userCoords.value = { lat: latitude, lng: longitude };

      noticeMessage.value = "Location detected! Showing nearby companies.";
      noticeType.value = "success";

      if (map) {
        map.setView([latitude, longitude], 13);

        if (userMarker) {
          userMarker.setLatLng([latitude, longitude]);
        } else {
          userMarker = L.marker([latitude, longitude], {
            icon: userLocationIcon,
          }).addTo(map);
          userMarker.bindPopup("<strong>📍 You are here!</strong>");
        }
      }

      fetchCompanies();
    },
    (error) => {
      locating.value = false;
      console.warn("Geolocation denied or failed:", error.message);
      noticeMessage.value =
        "Location permission denied or unavailable. Showing all tech hub companies.";
      noticeType.value = "warning";
      fetchCompanies();
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
};

// Watch for search query change to update pins
watch(searchQuery, () => {
  renderMarkers();
});

onMounted(() => {
  if (!mapContainer.value) return;

  // Initialize Leaflet Map
  map = L.map(mapContainer.value, {
    zoomControl: true,
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  // Add OpenStreetMap tile layer (Free, fast, no API key required)
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Attempt automatic geolocation on load
  locateUser();
});

onUnmounted(() => {
  if (map) {
    map.remove();
    map = null;
  }
});
</script>

<style>
/* Global Leaflet Custom Marker & Popup Styles */
.custom-user-marker {
  position: relative;
}
.user-pulse-dot {
  width: 14px;
  height: 14px;
  background: #0284c7;
  border: 3px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(2, 132, 199, 0.6);
  position: absolute;
  top: 5px;
  left: 5px;
  z-index: 2;
}
.user-pulse-ring {
  width: 24px;
  height: 24px;
  border: 2px solid #0284c7;
  border-radius: 50%;
  position: absolute;
  top: 0;
  left: 0;
  animation: pulse-ring 2s infinite ease-out;
}
@keyframes pulse-ring {
  0% {
    transform: scale(0.6);
    opacity: 1;
  }
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
}

.custom-company-marker {
  position: relative;
}
.company-pin {
  width: 34px;
  height: 34px;
  background: #0f172a;
  border: 2px solid #38bdf8;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  transition: transform 0.2s ease, background-color 0.2s ease;
}
.company-pin:hover {
  transform: rotate(-45deg) scale(1.15);
  background: #0284c7;
}
.pin-badge {
  transform: rotate(45deg);
  font-size: 16px;
}

/* Custom Popup Styles */
.job-leaflet-popup .leaflet-popup-content-wrapper {
  padding: 0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
}
.job-leaflet-popup .leaflet-popup-content {
  margin: 0;
  line-height: 1.4;
}
.custom-popup-card {
  padding: 1.25rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.popup-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.popup-logo {
  width: 38px;
  height: 38px;
  object-fit: contain;
  border-radius: 6px;
  background: #f8fafc;
  padding: 2px;
  border: 1px solid #e2e8f0;
}
.popup-company-name {
  margin: 0;
  font-size: 1.15rem;
  color: #0f172a;
  font-weight: 700;
}
.popup-distance {
  display: inline-block;
  font-size: 0.78rem;
  color: #0284c7;
  font-weight: 600;
  background: #e0f2fe;
  padding: 2px 6px;
  border-radius: 4px;
  margin-top: 2px;
}
.popup-address {
  font-size: 0.82rem;
  color: #64748b;
  margin: 0.4rem 0 0.8rem;
}
.popup-jobs-list {
  background: #f8fafc;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  margin-bottom: 0.9rem;
}
.popup-jobs-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: #334155;
  margin-bottom: 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.popup-job-item {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin-bottom: 0.25rem;
}
.job-bullet {
  color: #0284c7;
  font-weight: bold;
}
.popup-job-link {
  font-size: 0.85rem;
  color: #0284c7;
  text-decoration: none;
  font-weight: 500;
}
.popup-job-link:hover {
  text-decoration: underline;
}
.popup-actions {
  margin-top: 0.5rem;
}
.popup-apply-btn {
  display: block;
  text-align: center;
  background-color: #0284c7;
  color: #ffffff !important;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.6rem 1rem;
  border-radius: 6px;
  transition: background-color 0.2s ease;
}
.popup-apply-btn:hover {
  background-color: #0369a1;
}
</style>

<style scoped>
.job-map-container {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
}

.map-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.search-box {
  flex: 1;
  min-width: 240px;
}

.search-input {
  width: 100%;
  padding: 0.6rem 0.9rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.92rem;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #0284c7;
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.radius-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: #475569;
}

.radius-select {
  padding: 0.55rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.88rem;
  background: white;
  cursor: pointer;
  outline: none;
}

.locate-btn {
  background-color: #0f172a;
  color: #ffffff;
  border: none;
  padding: 0.55rem 1rem;
  border-radius: 6px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.locate-btn:hover:not(:disabled) {
  background-color: #1e293b;
}

.locate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.map-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1.25rem;
  font-size: 0.85rem;
  font-weight: 500;
}

.map-notice.info {
  background: #e0f2fe;
  color: #0369a1;
}

.map-notice.success {
  background: #dcfce7;
  color: #166534;
}

.map-notice.warning {
  background: #fef3c7;
  color: #92400e;
}

.map-notice.error {
  background: #fee2e2;
  color: #991b1b;
}

.close-notice-btn {
  background: transparent;
  border: none;
  font-size: 0.9rem;
  cursor: pointer;
  color: inherit;
}

.leaflet-map-element {
  width: 100%;
  height: 520px;
  background: #e2e8f0;
  z-index: 1;
}

.map-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.25rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  font-size: 0.82rem;
  color: #64748b;
}
</style>
