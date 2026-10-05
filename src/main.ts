import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import 'primeicons/primeicons.css'
import './styles/app.css'
import App from './App.vue'
import { AtlasPreset } from './theme'

createApp(App)
  .use(PrimeVue, {
    // '.app-dark' is never set, so the app stays in the light scheme.
    theme: { preset: AtlasPreset, options: { darkModeSelector: '.app-dark' } },
  })
  .use(ToastService)
  .use(ConfirmationService)
  .mount('#app')
