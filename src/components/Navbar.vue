<template>
  <nav class="navbar">
    <div class="nav-container">
      <router-link to="/" class="logo">🗺️ MapJobs</router-link>
      <div class="nav-links">
        <router-link to="/">Home</router-link>
        <template v-if="authStore.isAuthenticated">
          <span class="user-greeting">👋 {{ authStore.userName }}</span>
          <button @click="handleLogout" class="logout-btn">Logout</button>
        </template>
        <template v-else>
          <router-link to="/login">Sign In</router-link>
        </template>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { useRouter } from "vue-router";
import { useAuthStore } from "../store/auth.js";

const router = useRouter();
const authStore = useAuthStore();

const handleLogout = async () => {
  await authStore.logout();
  router.push("/login");
};
</script>

<style scoped>
.navbar {
  background-color: #1e293b;
  color: #fff;
  padding: 1rem 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
  text-decoration: none;
}
.nav-links {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.nav-links a {
  color: #cbd5e1;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}
.nav-links a:hover,
.nav-links a.router-link-active {
  color: #38bdf8;
}
.user-greeting {
  color: #94a3b8;
  font-size: 0.9rem;
}
.logout-btn {
  background: transparent;
  border: 1px solid #475569;
  color: #e2e8f0;
  padding: 0.35rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}
.logout-btn:hover {
  background: #334155;
  color: #fff;
}
</style>
