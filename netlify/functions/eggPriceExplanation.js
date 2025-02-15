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

import TimeFrameButtons from './TimeFrameButtons';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Mapping from month abbreviations to numbers
const monthMap = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
};

/**
 * Parse the USDA data date from row.year and row.reference_period_desc.
 * For example, if row.year = 2017 and row.reference_period_desc = "JUN",
 * this returns new Date(2017, 5, 1).
 */
function parseRefDate(row) {
  const { year, reference_period_desc } = row;
  const abbr = (reference_period_desc || '').toUpperCase().slice(0, 3);
  const m = monthMap[abbr] ?? 0;
  return new Date(year, m, 1);
}

/**
 * Compute a cutoff date for the selected timeframe.
 * Timeframe options: "1M", "3M", "6M", "1Y", "5Y", "10Y"
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
  const [fullData, setFullData] = useState([]); // All fetched data (10 years)
  const [chartData, setChartData] = useState(null);
  const [timeFrame, setTimeFrame] = useState('5Y'); // Default timeframe
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [explanation, setExplanation] = useState('');

  // 1) Fetch up to 10 years of data from USDA once
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

        // Use your Netlify function for the USDA proxy
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

        // Sort data by actual data date (year + reference_period_desc)
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

  // 2) Filter fullData based on the selected timeframe and build chartData
  useEffect(() => {
    if (!fullData.length) return;

    const cutoff = getCutoffDate(timeFrame);
    console.log(`Cutoff date for ${timeFrame}:`, cutoff);

    // Filter rows with a data date (built from year + reference_period_desc) >= cutoff
    const filtered = fullData.filter((row) => {
      const d = parseRefDate(row);
      return d >= cutoff;
    });
    console.log(`Filtered data count: ${filtered.length}`);

    // Build label and price arrays using the parsed date
    const labels = filtered.map((row) => {
      const d = parseRefDate(row);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    });

    const prices = filtered.map((row) => {
      let val = parseFloat(row.Value);
      return isNaN(val) ? null : val;
    });

    setChartData({
      labels,
      datasets: [
        {
          label: 'Egg Price ($/DOZEN)',
          data: prices,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          tension: 0.3,
          pointRadius: 2,
          borderWidth: 2,
        },
      ],
    });
  }, [fullData, timeFrame]);

  // 3) Handle chart clicks: when a data point is clicked, fetch an explanation.
  const handleChartClick = (event, activeElements) => {
    if (!activeElements || activeElements.length === 0) return;
    const index = activeElements[0].index;
    const label = chartData.labels[index];
    const price = chartData.datasets[0].data[index];
    setSelectedPoint({ label, price });
    fetchExplanation(label, price);
  };

  // 4) Call the Netlify function to fetch an explanation from an LLM.
  const fetchExplanation = async (label, price) => {
    const prompt = `Egg prices were $${price} per dozen on ${label}. Provide potential reasons (seasonal trends, supply/demand shifts, economic factors, etc.) that might explain this price.`;
    try {
      const response = await fetch('/.netlify/functions/eggPriceExplanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) {
        throw new Error(`LLM API error: ${response.statusText}`);
      }
      const result = await response.json();
      setExplanation(result.explanation);
    } catch (error) {
      setExplanation(`Error: ${error.message}`);
    }
  };

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
              Historical average price received for eggs ($/DOZEN) using actual data date.
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
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                onClick: handleChartClick,
                scales: {
                  x: {
                    grid: { display: false },
                    ticks: {
                      color: '#6b7280',
                      autoSkip: true,
                      maxTicksLimit: 8,
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

        {selectedPoint && (
          <div className="mt-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold">
              Explanation for {selectedPoint.label}
            </h3>
            <p className="mt-2 text-gray-700">
              {explanation || 'Loading explanation...'}
            </p>
          </div>
        )}

        <div className="mt-6 text-sm text-gray-500">
          <p>Data source: USDA National Agricultural Statistics Service</p>
          <p>
            Displaying data for date ≥{' '}
            {getCutoffDate(timeFrame).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}{' '}
            (Time frame: {timeFrame})
          </p>
        </div>
      </div>
    </div>
  );
};

export default PriceChart;
