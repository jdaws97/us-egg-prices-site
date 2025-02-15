import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { ArrowTrendingUpIcon } from '@heroicons/react/24/outline';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Update TimeFrameButtons to include all options
const TimeFrameButtons = ({ selected, onSelect }) => {
  const timeFrames = ['1M', '3M', '6M', '1Y', '5Y', '10Y'];
  return (
    <div className="flex gap-2 flex-wrap mb-4">
      {timeFrames.map((frame) => (
        <button
          key={frame}
          onClick={() => onSelect(frame)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${selected === frame ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          {frame}
        </button>
      ))}
    </div>
  );
};

// Helper: Parse USDA load_time string into a Date object
function parseLoadTime(loadTimeStr) {
  const isoStr = loadTimeStr.replace(' ', 'T');
  return new Date(isoStr);
}

// Compute cutoff date based on selected timeframe
function getCutoffDate(timeFrame) {
  const now = new Date();
  const cutoff = new Date(now);
  switch (timeFrame) {
    case '1M':
      cutoff.setMonth(cutoff.getMonth() - 1);
      break;
    case '3M':
      cutoff.setMonth(cutoff.getMonth() - 3);
      break;
    case '6M':
      cutoff.setMonth(cutoff.getMonth() - 6);
      break;
    case '1Y':
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      break;
    case '5Y':
      cutoff.setFullYear(cutoff.getFullYear() - 5);
      break;
    case '10Y':
      cutoff.setFullYear(cutoff.getFullYear() - 10);
      break;
    default:
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      break;
  }
  return cutoff;
}

const PriceChart = () => {
  const [fullData, setFullData] = useState([]);   // all fetched data
  const [chartData, setChartData] = useState(null);
  const [timeFrame, setTimeFrame] = useState('5Y'); // default timeframe
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch data once (we fetch 10 years of data)
  useEffect(() => {
    const fetchEggPrices = async () => {
      try {
        setLoading(true);
        setError(null);
        const currentYear = new Date().getFullYear();
        const from = currentYear - 10;
        const to = currentYear;

        const params = new URLSearchParams({
          commodity_desc: 'EGGS',
          statisticcat_desc: 'PRICE RECEIVED',
          freq_desc: 'MONTHLY',
          unit_desc: '$ / DOZEN',
          year__GE: from.toString(),
          year__LE: to.toString(),
          format: 'JSON',
        });

        // Use your Netlify function URL for USDA proxy:
        const response = await fetch(`/.netlify/functions/usdaProxy?${params}`, {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          throw new Error(`Invalid response: ${text.slice(0, 100)}`);
        }

        const data = await response.json();
        if (!data.data || data.data.length === 0) {
          throw new Error('No price data available');
        }

        // Sort by load_time ascending
        const sorted = data.data.sort((a, b) => {
          return parseLoadTime(a.load_time) - parseLoadTime(b.load_time);
        });

        setFullData(sorted);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEggPrices();
  }, []);

  // Filter fullData based on selected timeFrame and build chartData
  useEffect(() => {
    if (!fullData.length) return;

    const cutoff = getCutoffDate(timeFrame);
    console.log(`Cutoff date for ${timeFrame}:`, cutoff);
    const filtered = fullData.filter((row) => {
      const dateObj = parseLoadTime(row.load_time);
      return dateObj >= cutoff;
    });
    console.log(`Filtered data count: ${filtered.length}`);

    // Build labels as tidy date strings (e.g. "Apr 29, 2022")
    const labels = filtered.map((row) => {
      const dateObj = parseLoadTime(row.load_time);
      return dateObj.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    });

    // Build the prices array
    const prices = filtered.map((row) => {
      let val = parseFloat(row.Value);
      return isNaN(val) ? null : val;
    });

    setChartData({
      labels,
      datasets: [
        {
          label: 'Egg Price ($/DOZEN) - Using load_time',
          data: prices,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          pointRadius: 4,
          borderWidth: 2,
        },
      ],
    });
  }, [fullData, timeFrame]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-xl p-6 shadow-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-blue-100 rounded-lg">
            <ArrowTrendingUpIcon className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">US Egg Price Tracking</h1>
            <p className="text-gray-600">
              Historical average price received for eggs ($/DOZEN) by load_time
            </p>
          </div>
        </div>

        {/* TimeFrame Buttons */}
        <TimeFrameButtons selected={timeFrame} onSelect={setTimeFrame} />

        {loading && (
          <div className="h-96 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {error && (
          <div className="h-96 flex items-center justify-center text-red-600">
            Error: {error}
          </div>
        )}

        {chartData && !loading && !error && (
          <div className="h-96">
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  x: {
                    grid: { display: false },
                    ticks: {
                      color: '#6b7280',
                      autoSkip: true,
                      maxTicksLimit: 8, // limits number of labels
                    },
                  },
                  y: {
                    beginAtZero: false,
                    grid: { color: '#f3f4f6' },
                    ticks: {
                      color: '#6b7280',
                      callback: (value) => `$${value}`,
                    },
                  },
                },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#1f2937',
                    titleColor: '#f9fafb',
                    bodyColor: '#f9fafb',
                    callbacks: {
                      label: (context) => ` $${context.parsed.y}`,
                    },
                  },
                },
              }}
            />
          </div>
        )}

        <div className="mt-6 text-sm text-gray-500">
          <p>Data source: USDA National Agricultural Statistics Service</p>
          <p>
            Displaying data for load_time ≥ {getCutoffDate(timeFrame).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} (Time frame: {timeFrame})
          </p>
        </div>
      </div>
    </div>
  );
};

export default PriceChart;
