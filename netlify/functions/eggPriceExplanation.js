// netlify/functions/eggPriceExplanation.js
require('dotenv').config();
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async (event, context) => {
  try {
    // Expect a POST request with a JSON body containing "prompt" and "date"
    const { prompt, date } = JSON.parse(event.body);
    if (!date) {
      throw new Error("Date is required");
    }

    // Convert the provided date to an ISO string (YYYY-MM-DD)
    const isoDate = new Date(date).toISOString().split('T')[0];

    // Build a query for NewsData.io archive endpoint (using "egg price factors" as our search query)
    const newsQuery = 'egg price factors';
    
    // Get your NewsData.io API key from environment variables
    const newsApiKey = process.env.NEWS_DATA_API_KEY;
    if (!newsApiKey) {
      throw new Error("Missing NEWS_DATA_API_KEY");
    }

    // Construct the URL for NewsData.io's archive API with the date parameter
    const newsUrl = `https://newsdata.io/api/1/archive?apikey=${newsApiKey}&q=${encodeURIComponent(
      newsQuery
    )}&date=${isoDate}&language=en&page=1`;

    // Fetch articles from NewsData.io archive endpoint
    const newsResponse = await fetch(newsUrl);
    if (!newsResponse.ok) {
      const errorBody = await newsResponse.text();
      console.error("NewsData.io API error body:", errorBody);
      throw new Error(`NewsData.io API error: ${newsResponse.statusText}`);
    }
    const newsData = await newsResponse.json();
    
    // Concatenate article titles and source info as our news summary.
    let newsSummary = '';
    if (newsData.results && newsData.results.length > 0) {
      newsSummary = newsData.results
        .map((article) => {
          // Some articles might not have a source field; default to "Unknown Source"
          const source = article.source_id || 'Unknown Source';
          return `${article.title} - ${source}`;
        })
        .join('; ');
    } else {
      newsSummary = 'No relevant news found for this date.';
    }

    // Build a final combined prompt
    const basePrompt =
      "Provide a concise, 3-4 sentence analysis that considers potential factors such as seasonal trends, supply chain disruptions, feed costs, economic conditions, weather events, and market demand. Do not simply repeat the input.";
    const combinedPrompt = `${basePrompt} News context: ${newsSummary}. Original observation: ${prompt}`;

    // Call the Hugging Face Inference API with the combined prompt.
    const hfApiKey = process.env.HF_API_KEY; // Set this in Netlify environment variables
    const model = 'EleutherAI/gpt-neo-2.7B';
    const hfResponse = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(hfApiKey && { Authorization: `Bearer ${hfApiKey}` }),
        },
        body: JSON.stringify({
          inputs: combinedPrompt,
          parameters: {
            max_new_tokens: 100,
            do_sample: true,
            temperature: 0.7,
            top_p: 0.9,
          },
        }),
      }
    );

    if (!hfResponse.ok) {
      const errorBody = await hfResponse.text();
      console.error('Hugging Face API error body:', errorBody);
      throw new Error(`Hugging Face API error: ${hfResponse.statusText}`);
    }

    const result = await hfResponse.json();
    if (result.error) {
      throw new Error(`Hugging Face API returned error: ${result.error}`);
    }

    // Assume the model returns an array of generated texts.
    const explanation =
      Array.isArray(result) && result.length > 0
        ? result[0].generated_text
        : 'No explanation found.';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ explanation }),
    };
  } catch (error) {
    console.error('Error in eggPriceExplanation function:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
