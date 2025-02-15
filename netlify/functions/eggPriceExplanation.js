// netlify/functions/eggPriceExplanation.js
require('dotenv').config();
const fetch = (...args) =>
    import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async (event, context) => {
  try {
    // Expect a POST request with a JSON body containing a "prompt" field
    const { prompt } = JSON.parse(event.body);

    // For example, use Hugging Face's Inference API for a free model (e.g., GPT-Neo)
    // Make sure to set your Hugging Face API key in Netlify environment variables if needed.
    const hfApiKey = process.env.HF_API_KEY; // Set this in Netlify if required
    const model = 'EleutherAI/gpt-neo-125M'; // Or choose another free model

    const hfResponse = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(hfApiKey && { Authorization: `Bearer ${hfApiKey}` }),
        },
        body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 100 } }),
      }
    );

    if (!hfResponse.ok) {
      throw new Error(`Hugging Face API error: ${hfResponse.statusText}`);
    }

    const result = await hfResponse.json();
    // Assume the model returns an array of generated texts
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
