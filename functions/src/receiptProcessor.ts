import { onRequest } from "firebase-functions/v2/https";
import { GoogleGenAI } from "@google/genai";
import { createWorker } from "tesseract.js";
import { searchImages, SafeSearchType } from "duck-duck-scrape";

async function fetchProductImage(productName: string, brand: string = ""): Promise<string> {
    try {
        const query = `${brand} ${productName} product`.trim();
        console.log(`🔍 Searching image for: ${query}`);
        const searchResults = await searchImages(query, { safeSearch: SafeSearchType.STRICT });
        
        if (searchResults.results && searchResults.results.length > 0) {
            return searchResults.results[0].image;
        }
        return "";
    } catch (error) {
        console.error(`❌ Image search error for ${productName}:`, error);
        return "";
    }
}

export const processReceipt = onRequest(
    { timeoutSeconds: 300, memory: "2GiB" },
    async (req, res) => {
        try {
            const { image_data, store_context = "", raw_ocr = "" } = req.body;
            let ocrText = raw_ocr;

            if (!image_data && !raw_ocr) {
                res.status(400).json({ success: false, error: "image_data or raw_ocr required" });
                return;
            }

            // 1. Perform OCR if text isn't provided
            if (!ocrText) {
                const buffer = Buffer.from(image_data, 'base64');
                const worker = await createWorker('eng');
                const { data: { text } } = await worker.recognize(buffer);
                await worker.terminate();
                ocrText = text;
            }

            // 2. Initialize Vertex AI built into Firebase context
            const ai = new GoogleGenAI({
                vertexai: true,
                project: process.env.GCLOUD_PROJECT,
                location: process.env.FIREBASE_REGION || 'us-central1'
            });

            const structurePrompt = `
            Analyze this receipt OCR text and extract structured product data.
            Store Context: ${store_context}
            Receipt Text:
            ${ocrText}
            
            Return EXACTLY this JSON structure:
            {
                "store_info": { "name": "Store name", "date": "YYYY-MM-DD" },
                "line_items": [
                    {
                        "raw_description": "Original text",
                        "quantity": 1,
                        "unit_price": 2.99,
                        "total_price": 2.99,
                        "resolved_name": "Clear product name",
                        "brand": "Brand name or null",
                        "category": "Electronics/Grocery/Clothing etc"
                    }
                ]
            }`;

            // Generate content forcing JSON response
            const aiResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: structurePrompt,
                config: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            });

            const jsonText = aiResponse.text || "{}";
            const parsedData = JSON.parse(jsonText);

            // 3. Fetch Images for each item
            const finalItems = [];
            for (const item of parsedData.line_items || []) {
                const imageUrl = await fetchProductImage(item.resolved_name, item.brand);
                finalItems.push({ ...item, image_url: imageUrl });
            }

            res.json({
                success: true,
                receipt_data: {
                    store_info: parsedData.store_info,
                    items: finalItems
                }
            });
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);