/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./App.{js,ts,tsx}", "./src/**/*.{js,ts,tsx}"],
    theme: {
        extend: {
            colors: {
                primary: "#0077B6",
                accent: "#00B4D8",
                "gray-light": "#F5F5F5",
                "gray-medium": "#9CA3AF",
                "gray-dark": "#4B5563",
            },
            fontFamily: {
                sans: ["System"],
            },
        },
    },
    plugins: [],
};
