import { onRequest } from "firebase-functions/v2/https";
import { createAiObservabilityContext, createGeminiClient, flushPostHog } from "./ai";

export const compareProducts = onRequest(
    { timeoutSeconds: 60, memory: "512MiB" },
    async (req, res) => {
        const { products } = req.body;
        if (!products || products.length < 2) {
            res.status(400).json({ success: false, error: "Requires at least 2 products" });
            return;
        }

        try {
            const ai: any = createGeminiClient();
            const aiObservability = createAiObservabilityContext();

            const prompt = `
            You are an expert product reviewer. Compare these products:
            ${JSON.stringify(products, null, 2)}
            
            Return EXACTLY this JSON:
            {
                "comparison_summary": "Brief overall summary",
                "products_evaluated": [
                    { "name": "Name", "pros": ["Pro 1"], "cons": ["Con 1"], "value_score": 8.5 }
                ],
                "winner": { "name": "Winning Product", "reason": "Why" },
                "feature_differences": "Explanation"
            }`;

            const aiResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    temperature: 0.2,
                    responseMimeType: "application/json"
                },
                ...aiObservability
            });

            res.json({ success: true, comparison: JSON.parse(aiResponse.text || "{}") });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        } finally {
            await flushPostHog();
        }
    }
);