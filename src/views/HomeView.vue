<template>
  <div class="home-container">
    <!-- Hero Banner -->
    <header class="hero-section">
      <h1 class="hero-title">🗺️ Explore Jobs on the Map</h1>
      <p class="hero-subtitle">
        Find top tech companies hiring near you. Click any pin to explore open roles and apply directly on their career page.
      </p>
    </header>

    <!-- Interactive Leaflet Map -->
    <section class="map-section">
      <JobMap />
    </section>

    <!-- Quick Features Info -->
    <section class="features-grid">
      <div class="feature-card">
        <div class="feature-icon">📍</div>
        <h3>Location-Based Matching</h3>
        <p>Discover tech headquarters, offices, and engineering centers within your preferred commute radius.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">💼</div>
        <h3>Direct Career Portals</h3>
        <p>Skip the middleman. Apply directly to verified company career portals with one click.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">⚡</div>
        <h3>Real-Time Updates</h3>
        <p>Interactive spatial mapping powered by OpenStreetMap and MongoDB geospatial indexing.</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import JobMap from "../components/JobMap.vue";
</script>

<style scoped>
.home-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}

.hero-section {
  text-align: center;
  margin-bottom: 1.5rem;
}

.hero-title {
  font-size: 2.2rem;
  color: #0f172a;
  font-weight: 800;
  margin-bottom: 0.5rem;
  letter-spacing: -0.02em;
}

.hero-subtitle {
  font-size: 1.05rem;
  color: #64748b;
  max-width: 680px;
  margin: 0 auto;
  line-height: 1.5;
}

.map-section {
  margin-bottom: 2.5rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.feature-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  text-align: center;
}

.feature-icon {
  font-size: 2rem;
  margin-bottom: 0.75rem;
}

.feature-card h3 {
  font-size: 1.1rem;
  color: #0f172a;
  margin-bottom: 0.5rem;
}

.feature-card p {
  font-size: 0.9rem;
  color: #64748b;
  line-height: 1.5;
}
</style>
