import { extractProductFromVideo } from '../videoExtractor';
import { GoogleGenAI } from '@google/genai';
import youtubedl from 'youtube-dl-exec';
import ffmpeg from 'fluent-ffmpeg';
const fs = require('fs');

jest.mock('@google/genai');
jest.mock('youtube-dl-exec');
jest.mock('fluent-ffmpeg');
jest.mock('@ffmpeg-installer/ffmpeg', () => ({ path: '/mock/ffmpeg' }));

describe('videoExtractor', () => {
    let req: any;
    let res: any;
    let mockGenerateContent: jest.Mock;
    
    // Spies for fs to prevent actual disk operations
    let existsSpy: jest.SpyInstance;
    let unlinkSpy: jest.SpyInstance;
    let rmSpy: jest.SpyInstance;

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

        // Mock youtubedl
        (youtubedl as unknown as jest.Mock).mockResolvedValue({
            title: "Test Video",
            description: "Test Desc",
            thumbnail: "url"
        });

        // Mock ffmpeg
        const ffmpegChain = {
            screenshots: jest.fn().mockReturnThis(),
            on: jest.fn().mockImplementation(function(this: any, event: string, callback: Function) {
                if (event === 'end') process.nextTick(() => callback()); // Simulate async resolve
                return this;
            })
        };
        (ffmpeg as unknown as jest.Mock).mockReturnValue(ffmpegChain);
        (ffmpeg as unknown as any).setFfmpegPath = jest.fn();

        // Spy FS
        jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
        jest.spyOn(fs, 'readdirSync').mockReturnValue(['frame-1.jpg'] as any);
        jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('dummydata'));
        existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined);
        rmSpy = jest.spyOn(fs, 'rmSync').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('extractProductFromVideo', () => {
        it('returns 400 when missing video_url', async () => {
            req.body = {};
            await extractProductFromVideo(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ success: false, error: "video_url is required" });
        });

        it('extracts frames and parses AI response successfully', async () => {
            req.body = { video_url: "http://youtube.com/watch?v=123" };
            const aiResponse = JSON.stringify({ name: "Awesome Product" });
            mockGenerateContent.mockResolvedValue({ text: aiResponse });

            await extractProductFromVideo(req, res);

            expect(youtubedl).toHaveBeenCalledTimes(2); // Once for JSON info, once for video
            expect(ffmpeg).toHaveBeenCalled();
            expect(mockGenerateContent).toHaveBeenCalled();
            
            // Check cleanup
            expect(unlinkSpy).toHaveBeenCalled();
            expect(rmSpy).toHaveBeenCalled();

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                product: { name: "Awesome Product" },
                source_metadata: { title: "Test Video", uploader: undefined }
            });
        });

        it('returns 500 when youtube-dl fails', async () => {
            req.body = { video_url: "http://youtube.com/watch?v=123" };
            (youtubedl as unknown as jest.Mock).mockRejectedValueOnce(new Error("YT Error"));

            await extractProductFromVideo(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ success: false, error: "YT Error" });
            
            // Should still try to cleanup
            expect(existsSpy).toHaveBeenCalled();
        });
        
        it('returns 500 when AI fails', async () => {
            req.body = { video_url: "http://youtube.com/watch?v=123" };
            mockGenerateContent.mockRejectedValue(new Error("AI Crash"));

            await extractProductFromVideo(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ success: false, error: "AI Crash" });
        });
    });
});
