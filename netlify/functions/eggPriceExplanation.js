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

    // Build a query for the News API (using "egg price factors" as our search query)
    const newsQuery = 'egg price factors';
    const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
      newsQuery
    )}&from=${isoDate}&to=${isoDate}&language=en&pageSize=3`;

    // Get your News API key from environment variables
    const newsApiKey = process.env.NEWS_API_KEY;
    if (!newsApiKey) {
      throw new Error("Missing NEWS_API_KEY");
    }

    // Fetch articles from the News API
    const newsResponse = await fetch(newsUrl, {
      headers: { 'X-Api-Key': newsApiKey },
    });
    if (!newsResponse.ok) {
      const errorBody = await newsResponse.text();
      console.error("News API error body:", errorBody);
      throw new Error(`News API error: ${newsResponse.statusText}`);
    }
    const newsData = await newsResponse.json();
    
    // Concatenate article titles and source names as our news summary
    let newsSummary = '';
    if (newsData.articles && newsData.articles.length > 0) {
      newsSummary = newsData.articles
        .map((article) => `${article.title} - ${article.source.name}`)
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
