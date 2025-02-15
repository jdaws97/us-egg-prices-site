require('dotenv').config();
const fetch = (...args) =>
    import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async (event, context) => {
  try {
    const queryParams = new URLSearchParams(event.queryStringParameters);

    if (process.env.USDA_API_KEY) {
      queryParams.set('key', process.env.USDA_API_KEY);
    }

    const usdaUrl = `https://quickstats.nass.usda.gov/api/api_GET/?${queryParams}`;

    console.log('Fetching USDA URL:', usdaUrl);
    const response = await fetch(usdaUrl);
    if (!response.ok) {
      throw new Error(`USDA responded with status ${response.status}`);
    }

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error('Error in usdaProxy function:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
