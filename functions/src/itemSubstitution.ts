import { onRequest } from "firebase-functions/v2/https";
import { GoogleGenAI } from "@google/genai";

export const suggestSubstitutions = onRequest(
    { timeoutSeconds: 60, memory: "512MiB" },
    async (req, res) => {
        const { product, preferences } = req.body;
        
        if (!product || !product.name) {
            res.status(400).json({ success: false, error: "Product name is required." });
            return;
        }

        try {
            const ai = new GoogleGenAI({
                vertexai: true,
                project: process.env.GCLOUD_PROJECT,
                location: process.env.FIREBASE_REGION || 'us-central1'
            });

            // If the user specified a preference (e.g., "cheaper", "better quality"), include it
            const prefText = preferences 
                ? `Specific User Preference: ${preferences}` 
                : "Provide a mix of budget-friendly, direct competitors, and premium upgrades.";

            const prompt = `
            You are an expert personal shopper and tech/lifestyle product advisor.
            The user is currently looking at this product:
            
            Name: ${product.name}
            Brand: ${product.brand || 'Unknown'}
            Price: ${product.price ? '$' + product.price : 'Unknown'}
            Category: ${product.category || 'Unknown'}
            Description: ${product.description || 'N/A'}
            
            ${prefText}
            
            Task:
            Suggest 3 to 4 highly relevant alternative products (substitutions). 
            
            Return EXACTLY this JSON format:
            {
                "original_item_analysis": "A brief 1-sentence summary of the original item's market position.",
                "substitutions": [
                    {
                        "name": "Alternative Product Name",
                        "brand": "Alternative Brand",
                        "estimated_price": 99.99,
                        "type": "budget_friendly / direct_competitor / premium_upgrade",
                        "pros_vs_original": ["Pro 1", "Pro 2"],
                        "cons_vs_original": ["Con 1"],
                        "reason_for_suggestion": "Why the user might prefer this over the original."
                    }
                ]
            }`;

            const aiResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    temperature: 0.3, // Slightly higher than price analysis to allow for creative product matching
                    responseMimeType: "application/json"
                }
            });

            let jsonText = aiResponse.text || "{}";
            if (jsonText.startsWith("```json")) {
                jsonText = jsonText.replace(/```json/g, "").replace(/```/g, "").trim();
            }

            res.json({ 
                success: true, 
                target_product: product.name,
                analysis: JSON.parse(jsonText) 
            });
            
        } catch (error: any) {
            console.error("Substitution Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);