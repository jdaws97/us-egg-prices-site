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

// A small mapping from USDA's month abbreviations to 0..11
const monthMap = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
};

/**
 * Parse row.year + row.reference_period_desc into a real Date.
 * E.g. row.year=2017, row.reference_period_desc="JUN" => new Date(2017,5,1)
 */
function parseRefDate(row) {
  const { year, reference_period_desc } = row;
  const abbr = (reference_period_desc || '').toUpperCase().slice(0, 3); // e.g. "JUN"
  const m = monthMap[abbr] ?? 0;
  return new Date(year, m, 1);
}

// Time frame buttons for 1M, 3M, 6M, 1Y, 5Y, 10Y
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

/**
 * Compute a cutoff date for the selected timeframe:
 * 1M, 3M, 6M, 1Y, 5Y, 10Y
 */
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
  const [fullData, setFullData] = useState([]);   // All fetched data (10 years)
  const [chartData, setChartData] = useState(null);
  const [timeFrame, setTimeFrame] = useState('5Y'); // default
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 1) Fetch up to 10 years of data from USDA once
  useEffect(() => {
    const fetchEggPrices = async () => {
      try {
        setLoading(true);
        setError(null);

        const currentYear = new Date().getFullYear();
        const from = currentYear - 10;  // 10 years ago
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

        // Call your Netlify function or other proxy
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

        // 2) Sort by the "actual data date"
        //    i.e. year + reference_period_desc => parseRefDate
        const sorted = data.data.sort((a, b) => {
          return parseRefDate(a) - parseRefDate(b);
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

  // 3) Filter + build chart data based on selected timeframe
  useEffect(() => {
    if (!fullData.length) return;

    // For example, "5Y" => a date ~5 years ago
    const cutoff = getCutoffDate(timeFrame);
    console.log(`Cutoff date for ${timeFrame}:`, cutoff);

    // Filter the data to only those rows whose date >= cutoff
    const filtered = fullData.filter((row) => {
      const d = parseRefDate(row);
      return d >= cutoff;
    });
    console.log(`Filtered data count: ${filtered.length}`);

    // Build label + price arrays
    const labels = [];
    const prices = [];

    filtered.forEach((row) => {
      const d = parseRefDate(row);
      // E.g. "Jun 1, 2017"
      const labelStr = d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      let val = parseFloat(row.Value);
      if (isNaN(val)) {
        val = null; 
      }
      labels.push(labelStr);
      prices.push(val);
    });

    setChartData({
      labels,
      datasets: [
        {
          label: 'Egg Price ($/DOZEN)',
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
            <h1 className="text-2xl font-bold text-gray-800">
              US Egg Price Tracking
            </h1>
            <p className="text-gray-600">
              Historical average price received for eggs ($/DOZEN)
            </p>
          </div>
        </div>

        {/* Time Frame Buttons */}
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
                data={{
                    labels,
                    datasets: [
                    {
                        label: 'Egg Price ($/DOZEN)',
                        data: prices,
                        // A deeper blue for the line
                        borderColor: '#2563eb', // e.g. Tailwind's 'blue-600' = #2563eb
                        // A light fill area
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        // Slightly curved line
                        tension: 0.3,
                        // Smaller circles
                        pointRadius: 2,
                        // Thinner line
                        borderWidth: 2,
                    },
                    ],
                }}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#6b7280', autoSkip: true, maxTicksLimit: 8 },
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
            Using <code>year</code> + <code>reference_period_desc</code> to build the actual data date.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PriceChart;
