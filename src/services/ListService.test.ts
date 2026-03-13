import { ListService } from './ListService';
import { runTransaction, doc, serverTimestamp } from 'firebase/firestore';

// Mock the firestore functions
jest.mock('firebase/firestore', () => ({
  runTransaction: jest.fn(),
  doc: jest.fn(() => 'MOCKED_DOC_REF'),
  serverTimestamp: jest.fn(() => 'MOCKED_TIMESTAMP'),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  deleteDoc: jest.fn()
}));

// Mock the initialized Firebase DB instance
jest.mock('../api/firebase', () => ({
  db: {} // mock db object
}));

// Suppress console.warn during collision tests so the test output is clean
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = jest.fn();
});

afterAll(() => {
  console.warn = originalWarn;
});

describe('ListService.createList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully create a list when code is unique', async () => {
    const mockTransactionGet = jest.fn().mockResolvedValue({
      exists: () => false // code doesn't exist, unique!
    });
    const mockTransactionSet = jest.fn();

    const mockTransaction = {
      get: mockTransactionGet,
      set: mockTransactionSet
    };

    // @ts-ignore
    runTransaction.mockImplementation(async (db, updateFunction) => {
      return updateFunction(mockTransaction);
    });

    const result = await ListService.createList('user123', 'My New List');

    // We expect the result to be a 7 character string
    expect(typeof result).toBe('string');
    expect(result.length).toBe(7);

    // Verify transaction.get was called to check uniqueness inside runTransaction
    expect(mockTransactionGet).toHaveBeenCalled();
    
    // Verify transaction.set was called with correct data
    expect(mockTransactionSet).toHaveBeenCalledWith(
      'MOCKED_DOC_REF',
      expect.objectContaining({
        title: 'My New List',
        ownerId: 'user123',
        shareCode: result,
        allowedUsers: [],
        createdAt: 'MOCKED_TIMESTAMP',
        isPrivate: false
      })
    );
  });

  it('should retry when a collision is detected', async () => {
    // First call says it exists (collision), second call says it doesn't (unique)
    const mockTransactionGet = jest.fn()
      .mockResolvedValueOnce({ exists: () => true })
      .mockResolvedValueOnce({ exists: () => false });
      
    const mockTransactionSet = jest.fn();

    const mockTransaction = {
      get: mockTransactionGet,
      set: mockTransactionSet
    };

    // @ts-ignore
    runTransaction.mockImplementation(async (db, updateFunction) => {
      // The update function will either throw or succeed
      return updateFunction(mockTransaction);
    });

    const result = await ListService.createList('user123', 'My Retried List');

    // Verify it retried using the while loop (transaction ran twice)
    expect(mockTransactionGet).toHaveBeenCalledTimes(2);
    
    // Verify it succeeded on the second try
    expect(mockTransactionSet).toHaveBeenCalledTimes(1);
    expect(typeof result).toBe('string');
  });

  it('should throw an error after max attempts (5) are reached', async () => {
    // Always exists! (always collision)
    const mockTransactionGet = jest.fn().mockResolvedValue({ exists: () => true });
    const mockTransactionSet = jest.fn();

    const mockTransaction = {
      get: mockTransactionGet,
      set: mockTransactionSet
    };

    // @ts-ignore
    runTransaction.mockImplementation(async (db, updateFunction) => {
      return updateFunction(mockTransaction);
    });

    await expect(ListService.createList('user123', 'My Failed List'))
      .rejects
      .toThrow("Failed to generate a unique list code after multiple attempts.");

    // Max attempts is 5
    expect(mockTransactionGet).toHaveBeenCalledTimes(5);
    
    // Since all 5 attempts failed, set was never called
    expect(mockTransactionSet).not.toHaveBeenCalled();
  });
});
