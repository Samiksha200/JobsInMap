<template>
  <div class="job-map-container">
    <!-- Map Header / Filter Controls -->
    <div class="map-controls">
      <!-- Search Input -->
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search companies by name or address..."
          class="search-input"
        />
      </div>

      <!-- Radius & Location Controls -->
      <div class="filter-actions">
        <!-- Manual Radius Input -->
        <div class="radius-control-box">
          <span class="control-label">Radius:</span>
          <div class="manual-input-group">
            <input
              v-model.number="manualRadius"
              type="number"
              min="1"
              max="20000"
              placeholder="e.g. 30"
              @keyup.enter="applyManualRadius"
              class="manual-radius-input"
            />
            <span class="input-suffix">km</span>
            <button
              @click="applyManualRadius"
              class="apply-btn"
              title="Apply manual radius"
            >
              Apply
            </button>
          </div>

          <!-- Quick Presets -->
          <div class="preset-group">
            <button
              v-for="p in presets"
              :key="p.value"
              :class="['preset-chip', { active: !showAll && manualRadius === p.value }]"
              @click="setPresetRadius(p.value)"
            >
              {{ p.label }}
            </button>
            <button
              :class="['preset-chip', { active: showAll }]"
              @click="setAllCompanies"
            >
              All
            </button>
          </div>
        </div>

        <!-- My Location Button -->
        <button
          @click="locateUser"
          :disabled="locating"
          class="locate-btn"
          title="Center on my current location"
        >
          <span v-if="locating">📍 Locating...</span>
          <span v-else>🎯 My Location</span>
        </button>
      </div>
    </div>

    <!-- Status Notice Banner -->
    <div v-if="noticeMessage" class="map-notice" :class="noticeType">
      <span>{{ noticeMessage }}</span>
      <button @click="noticeMessage = ''" class="close-notice-btn">✕</button>
    </div>

    <!-- Leaflet Map Canvas -->
    <div ref="mapContainer" class="leaflet-map-element"></div>

    <!-- Map Footer Info -->
    <div class="map-footer">
      <span>
        Showing <strong>{{ filteredCompanies.length }}</strong> company locations
        <span v-if="!showAll && manualRadius > 0" class="active-radius-tag">
          (within {{ manualRadius }} km)
        </span>
      </span>
      <span v-if="userCoords">
        📍 Centered at {{ userCoords.lat.toFixed(3) }}, {{ userCoords.lng.toFixed(3) }}
      </span>
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
let radiusCircle = null;

const companies = ref([]);
const searchQuery = ref("");
const manualRadius = ref(50);
const selectedRadius = ref(50);
const showAll = ref(false);
const locating = ref(false);
const userCoords = ref(null);
const noticeMessage = ref("");
const noticeType = ref("info");

const presets = [
  { label: "10 km", value: 10 },
  { label: "25 km", value: 25 },
  { label: "50 km", value: 50 },
  { label: "100 km", value: 100 },
];

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
const createCompanyIcon = () => {
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

// Draw / update radius circle on map
const updateRadiusCircle = () => {
  if (!map) return;

  if (radiusCircle) {
    map.removeLayer(radiusCircle);
    radiusCircle = null;
  }

  if (userCoords.value && !showAll.value && selectedRadius.value > 0) {
    radiusCircle = L.circle([userCoords.value.lat, userCoords.value.lng], {
      color: "#0284c7",
      fillColor: "#38bdf8",
      fillOpacity: 0.1,
      weight: 2,
      dashArray: "6, 6",
      radius: selectedRadius.value * 1000, // Leaflet takes radius in meters
    }).addTo(map);

    map.fitBounds(radiusCircle.getBounds(), { padding: [35, 35], maxZoom: 14 });
  }
};

// Fetch companies from /api/companies/nearby or /api/companies
const fetchCompanies = async () => {
  try {
    let url = `${authStore.apiBaseUrl}/companies`;
    const params = {};

    if (userCoords.value && !showAll.value && selectedRadius.value > 0) {
      url = `${authStore.apiBaseUrl}/companies/nearby`;
      params.lat = userCoords.value.lat;
      params.lng = userCoords.value.lng;
      params.radius = selectedRadius.value;
    }

    const res = await axios.get(url, { params });
    if (res.data.success) {
      companies.value = res.data.data || [];
      renderMarkers();
      updateRadiusCircle();
    }
  } catch (err) {
    console.error("Failed to fetch companies:", err);
    noticeMessage.value = "Failed to load company markers from backend.";
    noticeType.value = "error";
  }
};

// Apply custom manual radius entered in input
const applyManualRadius = () => {
  if (!manualRadius.value || manualRadius.value <= 0) {
    noticeMessage.value = "Please enter a valid radius greater than 0 km.";
    noticeType.value = "warning";
    return;
  }
  showAll.value = false;
  selectedRadius.value = manualRadius.value;
  noticeMessage.value = `Applied custom search radius of ${manualRadius.value} km.`;
  noticeType.value = "info";
  fetchCompanies();
};

// Set preset radius
const setPresetRadius = (val) => {
  manualRadius.value = val;
  showAll.value = false;
  selectedRadius.value = val;
  fetchCompanies();
};

// Show all companies without distance filter
const setAllCompanies = () => {
  showAll.value = true;
  selectedRadius.value = 0;
  if (radiusCircle && map) {
    map.removeLayer(radiusCircle);
    radiusCircle = null;
  }
  fetchCompanies();
};

// Render pins on Leaflet map
const renderMarkers = () => {
  if (!map || !markersLayer) return;

  markersLayer.clearLayers();
  const bounds = L.latLngBounds();

  if (userCoords.value) {
    bounds.extend([userCoords.value.lat, userCoords.value.lng]);
  }

  filteredCompanies.value.forEach((comp) => {
    if (comp.lat == null || comp.lng == null) return;

    const latLng = [comp.lat, comp.lng];
    bounds.extend(latLng);

    const marker = L.marker(latLng, {
      icon: createCompanyIcon(),
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

  // Fit bounds if no user circle exists
  if (!userCoords.value && filteredCompanies.value.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }
};

// Geolocation function
const locateUser = () => {
  if (!navigator.geolocation) {
    noticeMessage.value = "Geolocation is not supported by your browser.";
    noticeType.value = "warning";
    fetchCompanies();
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

      noticeMessage.value = `Location detected (${latitude.toFixed(2)}, ${longitude.toFixed(2)})! Showing companies within ${manualRadius.value} km.`;
      noticeType.value = "success";

      if (map) {
        map.setView([latitude, longitude], 12);

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

// Watch search query to dynamically filter markers
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

  // Locate user on load
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
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.search-box {
  flex: 1;
  min-width: 250px;
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
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}

.radius-control-box {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.control-label {
  font-size: 0.88rem;
  font-weight: 600;
  color: #475569;
}

.manual-input-group {
  display: flex;
  align-items: center;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  overflow: hidden;
}

.manual-radius-input {
  width: 65px;
  padding: 0.45rem 0.5rem;
  border: none;
  font-size: 0.9rem;
  outline: none;
  font-weight: 600;
  color: #0f172a;
  text-align: center;
}

.input-suffix {
  font-size: 0.82rem;
  color: #64748b;
  font-weight: 600;
  padding-right: 0.4rem;
}

.apply-btn {
  background-color: #0284c7;
  color: white;
  border: none;
  padding: 0.45rem 0.75rem;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.apply-btn:hover {
  background-color: #0369a1;
}

.preset-group {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.preset-chip {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #475569;
  padding: 0.35rem 0.65rem;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.preset-chip:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.preset-chip.active {
  background: #0284c7;
  border-color: #0284c7;
  color: white;
}

.locate-btn {
  background-color: #0f172a;
  color: #ffffff;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
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

.active-radius-tag {
  color: #0284c7;
  font-weight: 600;
  margin-left: 4px;
}
</style>
