import { onRequest } from "firebase-functions/v2/https";
import { GoogleGenAI } from "@google/genai";

export const analyzePrice = onRequest(
    { timeoutSeconds: 60, memory: "512MiB" },
    async (req, res) => {
        const { product, history } = req.body;
        
        try {
            const ai = new GoogleGenAI({
                vertexai: true,
                project: process.env.GCLOUD_PROJECT,
                location: process.env.FIREBASE_REGION || 'us-central1'
            });

            const prompt = `
            You are an e-commerce pricing analyst. 
            Product: ${JSON.stringify(product)}
            History: ${JSON.stringify(history)}
            
            Return EXACTLY this JSON:
            {
                "current_deal_rating": "Excellent/Average/Poor",
                "average_historical_price": 0.00,
                "lowest_recorded_price": 0.00,
                "highest_recorded_price": 0.00,
                "volatility_status": "stable/volatile/seasonal",
                "recommendation": "Buy Now / Wait",
                "analysis_notes": "Brief explanation"
            }`;

            const aiResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            });

            res.json({ success: true, analysis: JSON.parse(aiResponse.text || "{}") });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);


export const analyzePriceNoHistory = onRequest(
    { timeoutSeconds: 60, memory: "512MiB" },
    async (req, res) => {
        const { product } = req.body;
        
        // Ensure we have the minimum required data
        if (!product || !product.name || product.price === undefined) {
            res.status(400).json({ success: false, error: "Product name and price are required." });
            return;
        }
        
        try {
            const ai = new GoogleGenAI({
                vertexai: true,
                project: process.env.GCLOUD_PROJECT,
                location: process.env.FIREBASE_REGION || 'us-central1'
            });

            // The prompt now relies on the AI's market knowledge rather than a provided history array
            const prompt = `
            You are an expert e-commerce pricing analyst and personal shopping assistant. 
            The user is considering buying the following product:
            
            Product Name: ${product.name}
            Brand: ${product.brand || 'Unknown'}
            Category: ${product.category || 'Unknown'}
            Current Listed Price: ${product.price} ${product.currency || 'USD'}
            
            Based on your knowledge of this product, this brand's pricing strategy, and general market value for this category, evaluate if this current price is a good deal.
            
            Tasks:
            1. Estimate the standard MSRP or typical street price for this item.
            2. Determine if the current price is Excellent (heavy discount), Fair (standard MSRP), or Poor (inflated/scalper pricing).
            3. Provide seasonal advice (e.g., "Wait for Black Friday" or "Apple products rarely drop further").
            
            Return EXACTLY this JSON format:
            {
                "estimated_standard_price": 0.00,
                "deal_rating": "Excellent/Fair/Poor",
                "price_context": "Briefly explain if this is below MSRP, at standard retail, or overpriced.",
                "seasonal_advice": "When does this typically go on sale?",
                "recommendation": "Buy Now / Wait / Shop Around",
                "analysis_notes": "A 1-2 sentence explanation of your recommendation."
            }`;

            const aiResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    temperature: 0.2, // Low temperature for more factual, grounded estimates
                    responseMimeType: "application/json"
                }
            });

            let jsonText = aiResponse.text || "{}";
            // Safety cleanup just in case
            if (jsonText.startsWith("```json")) {
                jsonText = jsonText.replace(/```json/g, "").replace(/```/g, "").trim();
            }

            res.json({ 
                success: true, 
                input_price: product.price,
                analysis: JSON.parse(jsonText) 
            });
            
        } catch (error: any) {
            console.error("Price Analysis Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);