import { compareSemver, UpdateService } from './UpdateService';
import { supabase } from '../api/supabase';

jest.mock('../api/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.11',
  },
}));

describe('UpdateService', () => {
  describe('compareSemver', () => {
    it('correctly identifies newer versions', () => {
      expect(compareSemver('1.0.12', '1.0.11')).toBe(1);
      expect(compareSemver('1.1.0', '1.0.9')).toBe(1);
      expect(compareSemver('2.0.0', '1.99.99')).toBe(1);
      expect(compareSemver('v1.0.12', '1.0.11')).toBe(1);
    });

    it('correctly identifies older versions', () => {
      expect(compareSemver('1.0.10', '1.0.11')).toBe(-1);
      expect(compareSemver('1.0.0', '1.1.0')).toBe(-1);
      expect(compareSemver('0.9.9', '1.0.0')).toBe(-1);
    });

    it('correctly identifies equal versions', () => {
      expect(compareSemver('1.0.11', '1.0.11')).toBe(0);
      expect(compareSemver('v1.0.11', '1.0.11')).toBe(0);
    });
  });

  describe('checkForUpdates', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('returns isAvailable: true when remote version is higher', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              value: {
                latest_version: '1.0.12',
                release_notes: 'New feature',
                download_url: 'https://example.com/app.apk',
              },
            },
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const info = await UpdateService.checkForUpdates();
      expect(info).not.toBeNull();
      expect(info?.isAvailable).toBe(true);
      expect(info?.latestVersion).toBe('1.0.12');
      expect(info?.currentVersion).toBe('1.0.11');
      expect(info?.releaseNotes).toBe('New feature');
      expect(info?.downloadUrl).toBe('https://example.com/app.apk');
      expect(info?.isForced).toBe(false);
    });

    it('returns isAvailable: false when app is up to date', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              value: {
                latest_version: '1.0.11',
              },
            },
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const info = await UpdateService.checkForUpdates();
      expect(info).not.toBeNull();
      expect(info?.isAvailable).toBe(false);
      expect(info?.latestVersion).toBe('1.0.11');
    });

    it('identifies forced updates when minimum_version is higher than current', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              value: {
                latest_version: '2.0.0',
                minimum_version: '2.0.0',
                force_update: true,
              },
            },
            error: null,
          }),
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const info = await UpdateService.checkForUpdates();
      expect(info?.isAvailable).toBe(true);
      expect(info?.isForced).toBe(true);
    });
  });
});
