
import { fetch } from "bun";

async function testImageGen() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("❌ GOOGLE_API_KEY is missing from environment variables");
    return;
  }

  console.log("🧪 Testing Gemini Image Generation API...");
  console.log("Model: gemini-3-pro-image-preview");
  
  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: "A cute robot holding a sign that says 'Test'" }]
          }],
          generationConfig: {
            responseModalities: ["Image"],
            imageConfig: { aspectRatio: "1:1" }
          }
        })
      }
    );

    console.log(`Status: ${response.status} ${response.statusText}`);
    
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      console.log("Response:", JSON.stringify(json, null, 2));
      
      if (json.error) {
        console.error("❌ API returned error:", json.error.message);
        if (json.error.code === 404) {
           console.log("💡 Hint: The model name might be incorrect.");
        }
      } else {
        console.log("✅ API call successful!");
      }
    } catch {
      console.log("Response text:", text);
    }
    
  } catch (error) {
    console.error("Error making request:", error);
  }
}

testImageGen();

