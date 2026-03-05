import { onRequest } from "firebase-functions/v2/https";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import * as cheerio from "cheerio";

export const extractProduct = onRequest(
    { timeoutSeconds: 120, memory: "1GiB" },
    async (req, res) => {
        const { url } = req.body;
        if (!url) {
            res.status(400).json({ success: false, error: "URL is required" });
            return;
        }

        try {
            // 1. Scrape Page with Enhanced Stealth Headers
            const response = await axios.get(url, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"Windows"'
                },
                timeout: 15000
            });
            
            const $ = cheerio.load(response.data);
            const pageTitle = $('title').text().toLowerCase();
            
            // Check for common Bot Detection pages
            if (pageTitle.includes('robot check') || pageTitle.includes('captcha') || pageTitle.includes('are you a human')) {
                res.status(403).json({ 
                    success: false, 
                    error: "Scraping blocked by the website's anti-bot protection (CAPTCHA).",
                    source: url
                });
                return;
            }

            const ogImage = $('meta[property="og:image"]').attr('content');
            const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text();
            const ogDesc = $('meta[property="og:description"]').attr('content');
            
            // Grab readable text, avoiding scripts and styles
            $('script, style').remove();
            const pageText = $('body').text().replace(/\s+/g, ' ').slice(0, 5000);
            
            const outboundLinks: string[] = [];
            $('a[href^="http"]').each((i, el) => {
                if (i < 20) outboundLinks.push($(el).attr('href')!);
            });

            // 2. Process with Firebase Vertex AI
            const ai = new GoogleGenAI({
                vertexai: true,
                project: process.env.GCLOUD_PROJECT,
                location: process.env.FIREBASE_REGION || 'us-central1'
            });

            const prompt = `
            Analyze this web page metadata to extract E-COMMERCE PRODUCT information.
            Original URL: ${url}
            Title: ${ogTitle}
            Description: ${ogDesc}
            Links found on page: ${JSON.stringify(outboundLinks)}
            
            Text Snippet:
            ${pageText}
            
            Task:
            1. Identify the product (Brand and Name).
            2. Extract price.
            3. CRITICAL: If the URL is social media (TikTok/IG/YouTube), find the ACTUAL storefront link (Amazon, Linktree) from the text or links array. Otherwise, use the Original URL.
            
            Return EXACTLY this JSON:
            {
                "name": "Product Name",
                "description": "Product Description",
                "price": 99.99,
                "currency": "USD",
                "brand": "Brand Name",
                "category": "Category",
                "storefront_url": "https://actual-store-link.com",
                "extracted_image_url": "${ogImage || ''}"
            }`;

            const aiResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            });

            res.json({ success: true, product: JSON.parse(aiResponse.text || "{}"), source: url });
        } catch (error: any) {
            // Handle Axios 503 errors (which Amazon often throws at bots)
            if (error.response && (error.response.status === 503 || error.response.status === 403)) {
                 res.status(error.response.status).json({ success: false, error: "Website blocked the connection (Bot Protection).", source: url });
                 return;
            }
            res.status(500).json({ success: false, error: error.message });
        }
    }
);