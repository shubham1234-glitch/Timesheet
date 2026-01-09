// Shared Chart.js configuration to avoid duplicate registrations and optimize performance
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from "chart.js";

// Register Chart.js components
// Registration is idempotent (safe to call multiple times), so we register directly
// This ensures components are registered before use
ChartJS.register(ArcElement, ChartTooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

// Memoized chart options for better performance
export const pieChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 0, // Disable animations for better performance
  },
  plugins: {
    legend: { 
      position: "bottom" as const,
      labels: {
        font: { family: "var(--font-poppins), Poppins, sans-serif", size: 12 },
        padding: 15,
        usePointStyle: true,
      },
    },
    tooltip: {
      titleFont: { family: "var(--font-poppins), Poppins, sans-serif", size: 13 },
      bodyFont: { family: "var(--font-poppins), Poppins, sans-serif", size: 12 },
      padding: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      titleColor: '#374151',
      bodyColor: '#6b7280',
      borderColor: '#e5e7eb',
      borderWidth: 1,
    },
  },
};

export const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 0, // Disable animations for better performance
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      titleFont: { family: "var(--font-poppins), Poppins, sans-serif", size: 13 },
      bodyFont: { family: "var(--font-poppins), Poppins, sans-serif", size: 12 },
      padding: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      titleColor: '#374151',
      bodyColor: '#6b7280',
      borderColor: '#e5e7eb',
      borderWidth: 1,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        font: { family: "var(--font-poppins), Poppins, sans-serif", size: 11 },
        color: '#6b7280',
      },
      grid: {
        color: '#f3f4f6',
      },
    },
    x: {
      ticks: {
        font: { family: "var(--font-poppins), Poppins, sans-serif", size: 11 },
        color: '#6b7280',
      },
      grid: {
        display: false,
      },
    },
  },
};

