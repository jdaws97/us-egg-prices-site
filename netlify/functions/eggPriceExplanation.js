// netlify/functions/eggPriceExplanation.js
require('dotenv').config();
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async (event, context) => {
  try {
    // Expect a POST request with a JSON body containing a "prompt" field
    const { prompt } = JSON.parse(event.body);

    // Prepend a base context to the prompt to steer the model toward providing a detailed analysis.
    const basePrompt =
      "Provide a concise 3-4 sentence analysis that considers seasonal trends, supply chain disruptions, feed costs, economic conditions, weather events, and market demand. Do not simply repeat the input. ";
    const improvedPrompt = basePrompt + prompt;

    const hfApiKey = process.env.HF_API_KEY; // Set this in Netlify if required
    const model = 'EleutherAI/gpt-neo-125M'; // Ensure the model name is correct

    const hfResponse = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(hfApiKey && { Authorization: `Bearer ${hfApiKey}` }),
        },
        body: JSON.stringify({
          inputs: improvedPrompt,
          parameters: {
            max_new_tokens: 100,
            do_sample: true,
            temperature: 0.7,
            top_p: 0.9
          },
        }),
      }
    );

    if (!hfResponse.ok) {
      // Log full response body for debugging
      const errorBody = await hfResponse.text();
      console.error('Hugging Face API error body:', errorBody);
      throw new Error(`Hugging Face API error: ${hfResponse.statusText}`);
    }

    const result = await hfResponse.json();
    // Check if result has an error field
    if (result.error) {
      throw new Error(`Hugging Face API returned error: ${result.error}`);
    }

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
