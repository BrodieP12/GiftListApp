import { compareProducts } from '../productComparison';
import { GoogleGenAI } from '@google/genai';

jest.mock('@google/genai');

describe('productComparison', () => {
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

    describe('compareProducts', () => {
        it('returns 400 when missing products array', async () => {
            req.body = {};
            await compareProducts(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ success: false, error: "Requires at least 2 products" });
        });

        it('returns 400 when products array has less than 2 items', async () => {
            req.body = { products: [{ name: "One" }] };
            await compareProducts(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ success: false, error: "Requires at least 2 products" });
        });

        it('returns success and parsed comparison data', async () => {
            req.body = { products: [{ name: "A" }, { name: "B" }] };
            const mockResponseText = JSON.stringify({ winner: { name: "A", reason: "Better" } });
            mockGenerateContent.mockResolvedValue({ text: mockResponseText });

            await compareProducts(req, res);

            expect(mockGenerateContent).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                comparison: { winner: { name: "A", reason: "Better" } },
            });
        });

        it('returns 500 when AI error occurs', async () => {
            req.body = { products: [{ name: "A" }, { name: "B" }] };
            mockGenerateContent.mockRejectedValue(new Error("AI Error"));

            await compareProducts(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ success: false, error: "AI Error" });
        });
    });
});
