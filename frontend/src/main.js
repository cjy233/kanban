import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import Dashboard from './views/Dashboard.vue'
import Processes from './views/Processes.vue'
import './assets/style.css'

const routes = [
  { path: '/', component: Dashboard },
  { path: '/processes', component: Processes }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
app.use(router)
app.mount('#app')
