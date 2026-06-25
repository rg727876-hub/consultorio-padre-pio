jest.mock('mysql2/promise', () => {
    const mockConnection = {
        query: jest.fn(),
        execute: jest.fn(),
        release: jest.fn(),
    };
    
    const mockPool = {
        getConnection: jest.fn().mockResolvedValue(mockConnection),
        query: jest.fn(),
        execute: jest.fn(),
        end: jest.fn()
    };
    
    return {
        createPool: jest.fn(() => mockPool)
    };
});

// Mock console.log and console.error so tests output is clean
beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
    if (console.log.mockRestore) console.log.mockRestore();
    if (console.error.mockRestore) console.error.mockRestore();
});
