import { ListService } from './ListService';

// The supabase client is mapped to __mocks__/supabaseMock.js via jest config.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const supabaseMock = require('@supabase/supabase-js');
const { supabase, __setResult, __reset } = supabaseMock;

jest.mock('./LoggingService', () => ({
  CrashLogger: { error: jest.fn() },
  AppLogger: { info: jest.fn() },
}));

describe('ListService.createList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __reset();
  });

  it('delegates to the create-list Edge Function and returns its result', async () => {
    __setResult({ data: { listId: 'list_1', shareCode: 'ABC1234' }, error: null });

    const result = await ListService.createList('user123', '  My New List  ', true);

    expect(supabase.functions.invoke).toHaveBeenCalledWith('create-list', {
      body: { title: 'My New List', isSharable: true },
    });
    expect(result).toEqual({ listId: 'list_1', shareCode: 'ABC1234' });
  });

  it('normalizes a missing shareCode to null', async () => {
    __setResult({ data: { listId: 'list_2', shareCode: undefined }, error: null });

    const result = await ListService.createList('user123', 'Private List', false);

    expect(result).toEqual({ listId: 'list_2', shareCode: null });
  });

  it('throws when the Edge Function returns an error', async () => {
    __setResult({ data: null, error: new Error('boom') });

    await expect(ListService.createList('user123', 'Bad List')).rejects.toThrow('boom');
  });
});

describe('ListService.getOwnedLists', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __reset();
  });

  it('maps snake_case rows into camelCase GiftList models', async () => {
    __setResult({
      data: [
        {
          id: 'l1',
          owner_id: 'user123',
          title: 'Birthday',
          is_private: false,
          share_code: 'XYZ9876',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: null,
        },
      ],
      error: null,
    });

    const lists = await ListService.getOwnedLists('user123');

    expect(supabase.from).toHaveBeenCalledWith('lists');
    expect(lists).toHaveLength(1);
    expect(lists[0]).toMatchObject({
      id: 'l1',
      ownerId: 'user123',
      title: 'Birthday',
      isPrivate: false,
      shareCode: 'XYZ9876',
    });
  });
});
