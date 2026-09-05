import { analyzePrice, analyzePriceNoHistory } from '../priceAnalyzer';
import { GoogleGenAI } from '@google/genai';

jest.mock('@google/genai');

describe('priceAnalyzer', () => {
    let req: any;
    let res: any;
    let mockGenerateContent: jest.Mock;

    beforeEach(() => {
        req = { body: {} };
        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
        };

        mockGenerateContent = jest.fn();
        (GoogleGenAI as jest.Mock).mockImplementation(() => ({
            models: {
                generateContent: mockGenerateContent,
            },
        }));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('analyzePrice', () => {
        it('returns success and parsed analysis data', async () => {
            req.body = { product: { id: "1" }, history: [] };
            const mockResponseText = JSON.stringify({ current_deal_rating: "Excellent" });
            mockGenerateContent.mockResolvedValue({ text: mockResponseText });

            await analyzePrice(req as any, res as any);

            expect(mockGenerateContent).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                analysis: { current_deal_rating: "Excellent" },
            });
        });

        it('returns 500 when AI error occurs', async () => {
            req.body = { product: {}, history: [] };
            mockGenerateContent.mockRejectedValue(new Error("AI Error"));

            await analyzePrice(req as any, res as any);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ success: false, error: "AI Error" });
        });
    });

    describe('analyzePriceNoHistory', () => {
        it('returns 400 when missing product parameters', async () => {
            req.body = { product: null };
            await analyzePriceNoHistory(req as any, res as any);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ success: false, error: "Product name and price are required." });
        });

        it('returns success and parses clean JSON', async () => {
            req.body = { product: { name: "Test Item", price: 100 } };
            const jsonText = JSON.stringify({ deal_rating: "Fair" });
            mockGenerateContent.mockResolvedValue({ text: jsonText });

            await analyzePriceNoHistory(req as any, res as any);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                input_price: 100,
                analysis: { deal_rating: "Fair" }
            });
        });

        it('strips backticks from response and returns success', async () => {
            req.body = { product: { name: "Test Item", price: 100 } };
            const jsonText = `\`\`\`json\n{"deal_rating": "Fair"}\n\`\`\``;
            mockGenerateContent.mockResolvedValue({ text: jsonText });

            await analyzePriceNoHistory(req as any, res as any);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                input_price: 100,
                analysis: { deal_rating: "Fair" }
            });
        });
        
        it('returns 500 when AI error occurs', async () => {
            req.body = { product: { name: "Test Item", price: 100 } };
            mockGenerateContent.mockRejectedValue(new Error("AI Error"));

            await analyzePriceNoHistory(req as any, res as any);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ success: false, error: "AI Error" });
        });
    });
});
