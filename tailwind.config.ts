import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        cloud: "#F6F8FB",
        line: "#E5EAF1",
        brand: "#C00000",
        success: "#C00000",
        graphite: "#0A0A0B",
        mist: "#FFF1F2"
      },
      boxShadow: {
        soft: "0 18px 55px rgba(17, 24, 39, 0.08)",
        lift: "0 18px 42px rgba(17, 24, 39, 0.13)",
        glass: "0 24px 70px rgba(17, 24, 39, 0.11)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
