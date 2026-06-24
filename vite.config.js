import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      external: ['@capacitor-community/bluetooth-le', '@capacitor/core'],
    },
  },
})
