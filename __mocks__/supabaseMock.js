/**
 * Jest mock for @supabase/supabase-js.
 *
 * Provides a chainable query-builder stub so service-layer tests can assert
 * which table/columns/filters were used without hitting a real backend.
 * Tests override resolved values via the helpers below, e.g.:
 *
 *   const { supabase, __setResult } = require('@supabase/supabase-js');
 *   __setResult({ data: [{ id: '1' }], error: null });
 */

let nextResult = { data: null, error: null };

function makeThenable(result) {
  // A builder where every chained method returns the same thenable, and
  // awaiting it resolves to the configured result.
  const builder = {
    select: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    update: jest.fn(() => builder),
    upsert: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    neq: jest.fn(() => builder),
    in: jest.fn(() => builder),
    contains: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    single: jest.fn(() => builder),
    maybeSingle: jest.fn(() => builder),
    then: (resolve) => resolve(result),
  };
  return builder;
}

const channel = {
  on: jest.fn(() => channel),
  subscribe: jest.fn(() => channel),
  unsubscribe: jest.fn(),
};

const supabase = {
  from: jest.fn(() => makeThenable(nextResult)),
  rpc: jest.fn(() => makeThenable(nextResult)),
  channel: jest.fn(() => channel),
  removeChannel: jest.fn(),
  functions: {
    invoke: jest.fn(() => Promise.resolve(nextResult)),
  },
  auth: {
    signInWithPassword: jest.fn(() => Promise.resolve({ data: {}, error: null })),
    signUp: jest.fn(() => Promise.resolve({ data: {}, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    resetPasswordForEmail: jest.fn(() => Promise.resolve({ data: {}, error: null })),
    verifyOtp: jest.fn(() => Promise.resolve({ data: {}, error: null })),
    updateUser: jest.fn(() => Promise.resolve({ data: {}, error: null })),
    getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
};

module.exports = {
  createClient: jest.fn(() => supabase),
  supabase,
  __setResult: (result) => {
    nextResult = result;
  },
  __reset: () => {
    nextResult = { data: null, error: null };
  },
};
