/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#25282c",
        muted: "#62665f",
        faint: "#92948a",
        accent: {
          DEFAULT: "#2a4559",
          hover: "#1f3342",
          light: "#e6ebef",
        },
        ok: "#3d7a5c",
        conflict: {
          DEFAULT: "#b8402f",
          light: "#f6dcd6",
        },
        radar: {
          bg: "#f4f2ec",
          panel: "rgba(255, 255, 255, 0.55)",
          border: "rgba(255, 255, 255, 0.9)",
          primary: "#25282c",
          muted: "#62665f",
          faint: "#92948a",
          accent: "#2a4559",
          conflict: "#b8402f",
          warning: "#c9822b",
          clean: "#3d7a5c",
        },
      },
      fontFamily: {
        sans: ["Newsreader", "Georgia", "serif"],
        serif: ["Newsreader", "Georgia", "serif"],
        mono: ["Courier Prime", "Courier", "monospace"],
        screenplay: ["Courier Prime", "Courier", "monospace"],
      },
      borderRadius: {
        panel: "22px",
        card: "14px",
        control: "10px",
      },
      boxShadow: {
        glass: "0 4px 20px -2px rgba(37, 40, 44, 0.05), 0 2px 6px -1px rgba(37, 40, 44, 0.03)",
        sheet: "0 10px 30px -4px rgba(37, 40, 44, 0.08), 0 4px 12px -2px rgba(37, 40, 44, 0.04)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
    },
  },
  plugins: [],
};
