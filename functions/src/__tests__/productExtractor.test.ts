import { extractProduct } from '../productExtractor';
import { GoogleGenAI } from '@google/genai';

jest.mock('@google/genai');

const originalFetch = global.fetch;

describe('productExtractor', () => {
    let req: any;
    let res: any;
    let mockGenerateContent: jest.Mock;
    let mockFetch: jest.Mock;

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

        mockFetch = jest.fn();
        global.fetch = mockFetch as any;
    });

    afterEach(() => {
        jest.clearAllMocks();
        global.fetch = originalFetch;
    });

    describe('extractProduct', () => {
        it('returns 400 when URL is missing', async () => {
            req.body = {};
            await extractProduct(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ success: false, error: "URL is required" });
        });

        it('returns 503 when website blocks connection', async () => {
            req.body = { url: "http://example.com" };
            mockFetch.mockResolvedValue({ status: 503 });

            await extractProduct(req, res);

            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: "Website blocked the connection (Bot Protection).",
                source: "http://example.com"
            });
        });

        it('returns 403 when captcha is detected in page title', async () => {
            req.body = { url: "http://example.com" };
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                text: async () => "<html><head><title>Robot Check</title></head><body></body></html>"
            });

            await extractProduct(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: "Scraping blocked by the website's anti-bot protection (CAPTCHA).",
                source: "http://example.com"
            });
        });

        it('returns 504 on Error named TimeoutError', async () => {
            req.body = { url: "http://example.com" };
            const timeoutErr = new Error("Timeout");
            timeoutErr.name = 'TimeoutError';
            mockFetch.mockRejectedValue(timeoutErr);

            await extractProduct(req, res);

            expect(res.status).toHaveBeenCalledWith(504);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: "Website parsing timed out.",
                source: "http://example.com"
            });
        });

        it('returns success and parses AI product data', async () => {
            req.body = { url: "http://example.com" };
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                text: async () => "<html><head><title>Shop</title></head><body>Buy this cool shirt</body></html>"
            });

            const aiResponse = JSON.stringify({ name: "Shirt", price: 20 });
            mockGenerateContent.mockResolvedValue({ text: aiResponse });

            await extractProduct(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                product: { name: "Shirt", price: 20 },
                source: "http://example.com"
            });
        });

        it('returns 500 when fetch response is not ok', async () => {
            req.body = { url: "http://example.com" };
            mockFetch.mockResolvedValue({ status: 404, ok: false });

            await extractProduct(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: "HTTP error! status: 404"
            });
        });
    });
});
