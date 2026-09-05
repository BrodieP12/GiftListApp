import { onRequest } from "firebase-functions/v2/https";
import { GoogleGenAI } from "@google/genai";

export const manageWishlist = onRequest(
    { timeoutSeconds: 60, memory: "512MiB" },
    async (req, res) => {
        const { owned_items, wishlist_items, budget } = req.body;
        
        try {
            const ai = new GoogleGenAI({
                vertexai: true,
                project: process.env.GCLOUD_PROJECT,
                location: process.env.FIREBASE_REGION || 'us-central1'
            });

            const prompt = `
            You are a personal shopper.
            Owned Gear: ${JSON.stringify(owned_items)}
            Wishlist: ${JSON.stringify(wishlist_items)}
            Budget: $${budget}
            
            1. Select best combinations of wishlist items maximizing value without exceeding budget.
            2. Suggest 2 relevant accessories based on owned/recommended gear.
            
            Return EXACTLY this JSON:
            {
                "recommended_purchases": [{ "name": "Item", "price": 99.99, "reason": "Why" }],
                "total_estimated_cost": 0.00,
                "remaining_budget": 0.00,
                "suggested_accessories": [{ "name": "Item", "estimated_price": 25.0, "reason": "Why" }],
                "purchase_strategy_notes": "Advice"
            }`;

            const aiResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    temperature: 0.2,
                    responseMimeType: "application/json"
                }
            });

            res.json({ success: true, analysis: JSON.parse(aiResponse.text || "{}") });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);