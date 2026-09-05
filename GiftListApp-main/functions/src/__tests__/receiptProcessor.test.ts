import { processReceipt } from '../receiptProcessor';
import { GoogleGenAI } from '@google/genai';
import { createWorker } from 'tesseract.js';
import { searchImages } from 'duck-duck-scrape';

jest.mock('@google/genai');
jest.mock('tesseract.js');
jest.mock('duck-duck-scrape');

describe('receiptProcessor', () => {
    let req: any;
    let res: any;
    let mockGenerateContent: jest.Mock;
    let mockRecognize: jest.Mock;
    let mockTerminate: jest.Mock;

    beforeEach(() => {
        req = { body: {} };
        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
        };

        // Mock GoogleGenAI
        mockGenerateContent = jest.fn();
        (GoogleGenAI as jest.Mock).mockImplementation(() => ({
            models: {
                generateContent: mockGenerateContent,
            },
        }));

        // Mock Tesseract
        mockRecognize = jest.fn().mockResolvedValue({ data: { text: "mocked ocr text" } });
        mockTerminate = jest.fn().mockResolvedValue(undefined);
        (createWorker as jest.Mock).mockResolvedValue({
            recognize: mockRecognize,
            terminate: mockTerminate,
        });

        // Mock DuckDuckGo Image Search
        (searchImages as jest.Mock).mockResolvedValue({
            results: [{ image: "http://example.com/image.jpg" }]
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('processReceipt', () => {
        it('returns 400 when both image_data and raw_ocr are missing', async () => {
            req.body = {};
            await processReceipt(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ success: false, error: "image_data or raw_ocr required" });
        });

        it('processes raw_ocr directly without calling Tesseract', async () => {
            req.body = { raw_ocr: "Some receipt text" };
            
            const aiResponse = JSON.stringify({
                store_info: { name: "Test Store" },
                line_items: [{ resolved_name: "Item 1" }]
            });
            mockGenerateContent.mockResolvedValue({ text: aiResponse });

            await processReceipt(req, res);

            // Should not call tesseract
            expect(createWorker).not.toHaveBeenCalled();
            expect(mockRecognize).not.toHaveBeenCalled();
            
            // Should call duck-duck-scrape
            expect(searchImages).toHaveBeenCalled();
            
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                receipt_data: {
                    store_info: { name: "Test Store" },
                    items: [
                        { resolved_name: "Item 1", image_url: "http://example.com/image.jpg" }
                    ]
                }
            });
        });

        it('uses Tesseract when only image_data is provided', async () => {
            req.body = { image_data: "base64string" };
            
            const aiResponse = JSON.stringify({
                store_info: { name: "Store" },
                line_items: []
            });
            mockGenerateContent.mockResolvedValue({ text: aiResponse });

            await processReceipt(req, res);

            expect(createWorker).toHaveBeenCalledWith('eng');
            expect(mockRecognize).toHaveBeenCalled();
            expect(mockTerminate).toHaveBeenCalled();
            
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                receipt_data: {
                    store_info: { name: "Store" },
                    items: []
                }
            });
        });

        it('handles image search errors gracefully, returning empty string for image_url', async () => {
            req.body = { raw_ocr: "text" };
            
            const aiResponse = JSON.stringify({
                store_info: { name: "Store" },
                line_items: [{ resolved_name: "Error Item" }]
            });
            mockGenerateContent.mockResolvedValue({ text: aiResponse });
            
            (searchImages as jest.Mock).mockRejectedValue(new Error("Search Failed"));

            await processReceipt(req, res);
            
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                receipt_data: {
                    store_info: { name: "Store" },
                    items: [
                        { resolved_name: "Error Item", image_url: "" }
                    ]
                }
            });
        });

        it('returns 500 when AI processing fails', async () => {
            req.body = { raw_ocr: "text" };
            mockGenerateContent.mockRejectedValue(new Error("AI Crash"));

            await processReceipt(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ success: false, error: "AI Crash" });
        });
    });
});
