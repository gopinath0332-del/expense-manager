<template>
  <!-- App shell: persistent navbar + router view -->
  <div class="em-layout">
    <!-- Navigation bar -->
    <nav class="navbar navbar-expand-lg sticky-top">
      <div class="container-fluid px-4">
        <!-- Brand / Logo -->
        <RouterLink class="navbar-brand d-flex align-items-center gap-2" to="/">
          <span style="font-size:1.4rem">💸</span>
          Expense Manager
        </RouterLink>

        <!-- Mobile toggle -->
        <button
          class="navbar-toggler border-0"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#mainNav"
          aria-controls="mainNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
          style="color: var(--em-text-secondary)"
        >
          <span style="font-size:1.2rem">☰</span>
        </button>

        <!-- Nav links -->
        <div class="collapse navbar-collapse" id="mainNav">
          <ul class="navbar-nav ms-auto align-items-lg-center gap-1">
            <li class="nav-item">
              <RouterLink class="nav-link" active-class="active" to="/">
                📊 Dashboard
              </RouterLink>
            </li>
            <li class="nav-item">
              <RouterLink class="nav-link" active-class="active" to="/upload">
                📤 Upload
              </RouterLink>
            </li>
            <li class="nav-item">
              <RouterLink class="nav-link" active-class="active" to="/expenses">
                📋 Expenses
              </RouterLink>
            </li>
            <li class="nav-item">
              <RouterLink class="nav-link" active-class="active" to="/history">
                📜 History
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>
    </nav>

    <!-- Main content via router -->
    <main class="em-main fade-in-up">
      <RouterView />
    </main>

    <!-- Footer -->
    <footer
      class="text-center py-3"
      style="color: var(--em-text-muted); font-size: 0.75rem; border-top: 1px solid var(--em-border-color);"
    >
      Expense Manager &mdash; Built with Vue 3 + Firebase
    </footer>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>
