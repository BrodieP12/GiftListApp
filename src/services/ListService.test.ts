import { ListService } from './ListService';

jest.mock('../api/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    })),
    removeChannel: jest.fn(),
    rpc: jest.fn(),
  },
}));

import { supabase } from '../api/supabase';

const mockFrom = supabase.from as jest.Mock;

function chainedBuilder(overrides: Record<string, jest.Mock> = {}) {
  const builder: Record<string, jest.Mock> = {};
  const methods = ['insert', 'upsert', 'update', 'delete', 'select', 'eq', 'neq', 'order', 'maybeSingle', 'single', 'in'];
  methods.forEach(m => {
    builder[m] = overrides[m] ?? jest.fn(() => builder);
  });
  return builder;
}

describe('ListService.createList', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('returns a listId and null shareCode for private list', async () => {
    const builder = chainedBuilder({
      single: jest.fn().mockResolvedValue({ data: { id: 'list-abc' }, error: null }),
    });
    mockFrom.mockReturnValue(builder);
    // upsert for list_members
    mockFrom.mockReturnValueOnce(builder).mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    });

    const result = await ListService.createList('user1', 'My List', false);
    expect(result.shareCode).toBeNull();
  });

  it('returns a 7-character shareCode for a sharable list', async () => {
    const builder = chainedBuilder({
      single: jest.fn().mockResolvedValue({ data: { id: 'list-xyz' }, error: null }),
    });
    mockFrom
      .mockReturnValueOnce(builder)
      .mockReturnValue({ upsert: jest.fn().mockResolvedValue({ error: null }) });

    const result = await ListService.createList('user1', 'Shared List', true);
    expect(typeof result.shareCode).toBe('string');
    expect(result.shareCode!.length).toBe(7);
  });

  it('throws if supabase insert fails', async () => {
    const builder = chainedBuilder({
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    });
    mockFrom.mockReturnValue(builder);

    await expect(ListService.createList('user1', 'Bad List')).rejects.toBeTruthy();
  });
});

describe('ListService.getList', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('returns null when list not found', async () => {
    const builder = chainedBuilder({
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockFrom.mockReturnValue(builder);

    const result = await ListService.getList('nonexistent');
    expect(result).toBeNull();
  });

  it('maps a row to a GiftList', async () => {
    const row = {
      id: 'list1', owner_id: 'owner1', title: 'Test', is_private: false,
      share_code: 'ABC1234', created_at: '2024-01-01', updated_at: '2024-01-02',
    };
    const builder = chainedBuilder({
      maybeSingle: jest.fn().mockResolvedValue({ data: row, error: null }),
    });
    mockFrom.mockReturnValue(builder);

    const result = await ListService.getList('list1');
    expect(result).toMatchObject({
      id: 'list1',
      ownerId: 'owner1',
      title: 'Test',
      isPrivate: false,
      shareCode: 'ABC1234',
    });
  });
});
