/**
 * Image generation service using NANO-BANANA (Gemini 2.5 Flash Image)
 */

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

/**
 * Generate an image using NANO-BANANA (Gemini 2.5 Flash Image)
 */
export async function generateImageWithNanoBanana(
  prompt: string,
  aspectRatio: string = "1:1"
): Promise<ImageGenerationResult> {
  try {
    console.log(`[Image Generation] Generating image with NANO-BANANA: "${prompt}"`);

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': process.env.GOOGLE_API_KEY!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseModalities: ["Image"],
            imageConfig: { aspectRatio }
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Image Generation] NANO-BANANA API error:", errorText);

      return {
        success: false,
        error: `API error: ${response.status}`
      };
    }

    const data = await response.json();

    // Check if image was generated
    const candidate = data.candidates?.[0];
    if (!candidate) {
      console.error("[Image Generation] No candidates returned");
      return {
        success: false,
        error: "No image generated"
      };
    }

    // Check finish reason
    if (candidate.finishReason === "NO_IMAGE") {
      console.error("[Image Generation] NO_IMAGE finish reason");
      return {
        success: false,
        error: "Image generation declined by model (try a different prompt)"
      };
    }

    // Extract base64 image data
    const imagePart = candidate.content?.parts?.[0];
    if (!imagePart?.inlineData?.data) {
      console.error("[Image Generation] No image data in response");
      return {
        success: false,
        error: "No image data in response"
      };
    }

    // Convert to data URL
    const mimeType = imagePart.inlineData.mimeType || "image/jpeg";
    const base64Data = imagePart.inlineData.data;
    const imageUrl = `data:${mimeType};base64,${base64Data}`;

    console.log(`[Image Generation] Image generated successfully`);

    return {
      success: true,
      imageUrl
    };
  } catch (error) {
    console.error("[Image Generation] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
