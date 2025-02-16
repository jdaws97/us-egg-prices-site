require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const HF_API_KEY = process.env.HF_API_KEY;
const MODEL = 'mistralai/mistral-7b-instruct';

exports.handler = async (event, context) => {
  try {
    const { date, price } = JSON.parse(event.body);
    if (!date || !price) throw new Error('Missing required parameters');
    
    // Check cache (we'll add this in the front-end)
    const cacheKey = `${date}-${price}`;
    
    // Fetch relevant news articles
    const newsUrl = `https://newsapi.org/v2/everything?q=egg+prices&from=${date}&to=${date}&sortBy=relevancy&apiKey=${NEWS_API_KEY}`;
    const newsResponse = await fetch(newsUrl);
    const newsData = await newsResponse.json();
    
    let newsSummary = '';
    if (newsData.articles && newsData.articles.length > 0) {
      newsSummary = newsData.articles.slice(0, 3).map(a => `- ${a.title}: ${a.description}`).join('\n');
    }
    
    const prompt = `On ${date}, egg prices were $${price} per dozen. Analyze potential factors such as seasonal trends, supply chain issues, feed costs, economic conditions, weather events, and market demand. Recent news: ${newsSummary}`;
    
    // Call Hugging Face API
    const hfResponse = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${HF_API_KEY}`,
      },
      body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 100, temperature: 0.7 } })
    });
    
    if (!hfResponse.ok) throw new Error(`Hugging Face API error: ${hfResponse.statusText}`);
    
    const result = await hfResponse.json();
    const explanation = Array.isArray(result) ? result[0].generated_text : 'No explanation found.';
    
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ explanation }) };
  } catch (error) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
  }
};
