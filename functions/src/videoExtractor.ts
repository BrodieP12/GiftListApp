import { onRequest } from "firebase-functions/v2/https";
import { GoogleGenAI } from "@google/genai";
import youtubedl from "youtube-dl-exec";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export const extractProductFromVideo = onRequest(
    { timeoutSeconds: 540, memory: "4GiB" },
    async (req, res) => {
        const { video_url } = req.body;
        if (!video_url) {
            res.status(400).json({ success: false, error: "video_url is required" });
            return;
        }

        const tempDir = os.tmpdir();
        const videoPath = path.join(tempDir, `video_${Date.now()}.mp4`);
        const framesDir = path.join(tempDir, `frames_${Date.now()}`);

        try {
            console.log(`🎥 Downloading video: ${video_url}`);
            
            // 1. Download video and metadata using yt-dlp
            const info = await youtubedl(video_url, {
                dumpJson: true,
                noWarnings: true,
                // These arguments help mimic a browser more effectively
                args: [
                    '--extractor-args', 'youtube:player_client=android,web',
                    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                ]
            });
            
            await youtubedl(video_url, {
                output: videoPath,
                format: 'worst', 
                noWarnings: true,
            });

            // 2. Extract frames using ffmpeg
            fs.mkdirSync(framesDir);
            console.log("🎬 Extracting frames...");
            
            await new Promise((resolve, reject) => {
                ffmpeg(videoPath)
                    .screenshots({
                        count: 4, // 4 frames is perfect for Gemini
                        folder: framesDir,
                        filename: 'frame-%i.jpg',
                        size: '800x?'
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });

            // Read frames into base64
            const framesB64: string[] = [];
            const files = fs.readdirSync(framesDir);
            for (const file of files) {
                const buffer = fs.readFileSync(path.join(framesDir, file));
                framesB64.push(buffer.toString('base64'));
            }

            // 3. Analyze with Firebase Vertex AI (Multimodal)
            const ai = new GoogleGenAI({
                vertexai: true,
                project: process.env.GCLOUD_PROJECT,
                location: process.env.FIREBASE_REGION || 'us-central1'
            });
            
            const promptText = `
            Analyze these video frames and metadata to extract E-COMMERCE PRODUCT information.
            Title: ${(info as any).title}
            Description: ${(info as any).description}
            
            Tasks:
            1. Identify the product shown in the images.
            2. Find the ACTUAL storefront URL (e.g. Amazon, Linktree) from the description text.
            
            Return EXACTLY this JSON:
            {
                "name": "Product Name",
                "brand": "Brand",
                "category": "Category",
                "price": 99.99,
                "storefront_url": "extracted link",
                "extracted_image_url": "${(info as any).thumbnail || ''}"
            }`;

            // Construct parts payload for Gemini Multimodal
            const parts: any[] = [{ text: promptText }];
            framesB64.forEach(b64 => {
                parts.push({
                    inlineData: { mimeType: "image/jpeg", data: b64 }
                });
            });

            const aiResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: parts }],
                config: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            });

            res.json({
                success: true,
                product: JSON.parse(aiResponse.text || "{}"),
                source_metadata: { title: (info as any).title, uploader: (info as any).uploader }
            });

        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        } finally {
            if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
            if (fs.existsSync(framesDir)) fs.rmSync(framesDir, { recursive: true, force: true });
        }
    }
);