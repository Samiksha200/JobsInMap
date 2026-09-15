<template>
  <div class="page-container">
    <div class="card">
      <h1>Welcome to MapJobs</h1>
      <p class="subtitle">Discover jobs mapped to your preferred locations.</p>
      
      <div class="status-box">
        <h3>System Configuration</h3>
        <p><strong>API Base URL:</strong> <code>{{ authStore.apiBaseUrl }}</code></p>
        <button @click="checkBackendHealth" :disabled="loading" class="btn">
          {{ loading ? "Testing..." : "Test Backend Connection" }}
        </button>
        <div v-if="healthStatus" class="health-result" :class="healthStatus.status">
          <strong>Backend Status:</strong> {{ healthStatus.status }} ({{ healthStatus.service }})
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useAuthStore } from "../store/auth.js";
import axios from "axios";

const authStore = useAuthStore();
const healthStatus = ref(null);
const loading = ref(false);

const checkBackendHealth = async () => {
  loading.value = true;
  healthStatus.value = null;
  try {
    const res = await axios.get(`${authStore.apiBaseUrl}/health`);
    healthStatus.value = res.data;
  } catch (err) {
    healthStatus.value = {
      status: "error",
      service: err.message || "Failed to reach backend",
    };
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.page-container {
  max-width: 800px;
  margin: 2rem auto;
  padding: 0 1rem;
}
.card {
  background: white;
  padding: 2.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  text-align: center;
}
h1 {
  font-size: 2.2rem;
  color: #0f172a;
  margin-bottom: 0.5rem;
}
.subtitle {
  color: #64748b;
  font-size: 1.1rem;
  margin-bottom: 2rem;
}
.status-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  text-align: left;
}
.status-box h3 {
  margin-top: 0;
  color: #334155;
}
code {
  background: #e2e8f0;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
}
.btn {
  margin-top: 1rem;
  background-color: #0284c7;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  font-size: 0.95rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.2s;
}
.btn:hover:not(:disabled) {
  background-color: #0369a1;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.health-result {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 6px;
}
.health-result.ok {
  background-color: #dcfce7;
  color: #166534;
}
.health-result.error {
  background-color: #fee2e2;
  color: #991b1b;
}
</style>
