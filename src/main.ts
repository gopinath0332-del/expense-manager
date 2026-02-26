/**
 * Application entry point
 *
 * Bootstraps the Vue 3 app with:
 *  - Bootstrap 5 CSS for styling
 *  - bootstrap-vue-next plugin for UI components
 *  - Pinia for state management
 *  - Vue Router for navigation
 *  - Custom global styles
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createBootstrap } from 'bootstrap-vue-next'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-vue-next/dist/bootstrap-vue-next.css'

import App from './App.vue'
import router from './router'
import './style.css'

// Create and mount the Vue app
const app = createApp(App)

// Register Pinia for global state management
app.use(createPinia())

// Register Vue Router for SPA navigation
app.use(router)

// Register Bootstrap Vue Next plugin (registers all BV components globally)
app.use(createBootstrap())

app.mount('#app')
