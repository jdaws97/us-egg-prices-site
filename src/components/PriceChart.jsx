import React, { useState, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import TimeFrameButtons from './TimeFrameButtons';

const PriceChart = () => {
  const [fullData, setFullData] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [timeFrame, setTimeFrame] = useState('5Y');
  const [loading, setLoading] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [explanation, setExplanation] = useState('');
  const cacheRef = useRef({});

  useEffect(() => {
    async function fetchEggPrices() {
      setLoading(true);
      try {
        const response = await fetch(`/.netlify/functions/usdaProxy?year__GE=2015&year__LE=2025&format=JSON`);
        const data = await response.json();
        setFullData(data.data);
      } catch (err) {
        console.error('Error fetching egg prices:', err);
      }
      setLoading(false);
    }
    fetchEggPrices();
  }, []);

  const handleChartClick = async (event, activeElements) => {
    if (!activeElements || activeElements.length === 0) return;
    const index = activeElements[0].index;
    const label = chartData.labels[index];
    const price = chartData.datasets[0].data[index];
    const cacheKey = `${label}-${price}`;
    
    if (cacheRef.current[cacheKey]) {
      setExplanation(cacheRef.current[cacheKey]);
      return;
    }
    
    setExplanation('Loading...');
    try {
      const response = await fetch('/.netlify/functions/eggPriceExplanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: label, price }),
      });
      const result = await response.json();
      cacheRef.current[cacheKey] = result.explanation;
      setExplanation(result.explanation);
    } catch (error) {
      setExplanation(`Error fetching explanation: ${error.message}`);
    }
  };

  return (
    <div>
      <TimeFrameButtons selected={timeFrame} onSelect={setTimeFrame} />
      <div className="chart-container">
        <Line data={chartData} onClick={handleChartClick} />
      </div>
      {selectedPoint && <p>{explanation}</p>}
    </div>
  );
};

export default PriceChart;
