import { manageWishlist } from '../wishlistManager';
import { GoogleGenAI } from '@google/genai';

jest.mock('@google/genai');

describe('wishlistManager', () => {
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

    describe('manageWishlist', () => {
        it('returns success and parses AI analysis data', async () => {
            req.body = { owned_items: [], wishlist_items: ["Item A"], budget: 100 };
            
            const mockResponseText = JSON.stringify({
                recommended_purchases: [{ name: "Item A", price: 50 }],
                total_estimated_cost: 50,
                remaining_budget: 50
            });
            mockGenerateContent.mockResolvedValue({ text: mockResponseText });

            await manageWishlist(req, res);

            expect(mockGenerateContent).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                analysis: {
                    recommended_purchases: [{ name: "Item A", price: 50 }],
                    total_estimated_cost: 50,
                    remaining_budget: 50
                },
            });
        });

        it('returns 500 when AI error occurs', async () => {
            req.body = { budget: 100 };
            mockGenerateContent.mockRejectedValue(new Error("AI Crash"));

            await manageWishlist(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ success: false, error: "AI Crash" });
        });
    });
});
