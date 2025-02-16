// netlify/functions/eggPriceExplanation.js
require('dotenv').config();
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

exports.handler = async (event, context) => {
  try {
    // Expect a POST request with a JSON body containing a "prompt" field.
    const { prompt } = JSON.parse(event.body);
    
    // Construct a search query for DuckDuckGo.
    // Here we use a query that includes "egg price factors" along with the prompt details.
    const searchQuery = `egg price factors ${prompt}`;
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&no_redirect=1&no_html=1`;
    
    // Fetch from DuckDuckGo Instant Answer API.
    const ddgResponse = await fetch(ddgUrl);
    const ddgData = await ddgResponse.json();
    
    // Extract a summary from DuckDuckGo's result.
    let ddgSummary = '';
    if (ddgData.Abstract && ddgData.Abstract.length > 0) {
      ddgSummary = ddgData.Abstract;
    } else if (
      ddgData.RelatedTopics &&
      Array.isArray(ddgData.RelatedTopics) &&
      ddgData.RelatedTopics.length > 0 &&
      ddgData.RelatedTopics[0].Text
    ) {
      ddgSummary = ddgData.RelatedTopics[0].Text;
    }
    
    // Build a final combined prompt with a clear delimiter.
    const basePrompt =
      "Provide a concise, 3-4 sentence analysis that considers potential factors such as seasonal trends, supply chain disruptions, feed costs, economic conditions, weather events, and market demand. Do not simply repeat the input.";
    const combinedPrompt = `${basePrompt}\n\nDuckDuckGo context: ${ddgSummary}\n\nOriginal observation: ${prompt}\n\nExplanation:`;
    
    // Call the Hugging Face Inference API with the combined prompt.
    const hfApiKey = process.env.HF_API_KEY; // Set this in Netlify environment variables
    const model = 'mistralai/Mistral-7B-Instruct-v0.3'; // Ensure the model name is correct
    
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
            max_new_tokens: 500,
            do_sample: true,
            temperature: 0.7,
            top_p: 0.9,
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
    if (result.error) {
      throw new Error(`Hugging Face API returned error: ${result.error}`);
    }
    
    // Assume the model returns an array of generated texts.
    let explanation =
      Array.isArray(result) && result.length > 0
        ? result[0].generated_text
        : 'No explanation found.';
    
    // Post-process: Remove any prompt text by extracting text after "Explanation:"
    const delimiter = "Explanation:";
    const delimiterIndex = explanation.indexOf(delimiter);
    if (delimiterIndex !== -1) {
      explanation = explanation.substring(delimiterIndex + delimiter.length).trim();
    }
    
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
