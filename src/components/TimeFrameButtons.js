import React from 'react';

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

export default TimeFrameButtons;
