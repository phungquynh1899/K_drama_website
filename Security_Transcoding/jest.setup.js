// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Suppress console.log during tests (optional)
// Uncomment the lines below if you want to completely suppress console.log in tests
// const originalConsoleLog = console.log;
// console.log = jest.fn();

// Restore console.log after tests (if you uncommented above)
// afterAll(() => {
//     console.log = originalConsoleLog;
// }); 