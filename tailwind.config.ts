import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        cloud: "#F6F8FB",
        line: "#E5EAF1",
        brand: "#3B82F6",
        success: "#16A34A"
      },
      boxShadow: {
        soft: "0 16px 50px rgba(15, 23, 42, 0.08)",
        lift: "0 10px 28px rgba(15, 23, 42, 0.10)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
