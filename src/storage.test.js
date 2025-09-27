
// Mock the chrome.storage.local API for testing
global.chrome = {
  storage: {
    local: (() => {
      let store = {};
      return {
        get: jest.fn((keys, callback) => {
          const result = {};
          const keyList = Array.isArray(keys) ? keys : [keys];
          keyList.forEach(key => {
            if (store[key] !== undefined) {
              result[key] = store[key];
            }
          });
          if (callback) {
            callback(result);
          }
          return Promise.resolve(result);
        }),
        set: jest.fn((items, callback) => {
          store = { ...store, ...items };
          if (callback) {
            callback();
          }
          return Promise.resolve();
        }),
        remove: jest.fn((keys, callback) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          keyList.forEach(key => {
            delete store[key];
          });
          if (callback) {
            callback();
          }
          return Promise.resolve();
        }),
        clear: () => {
          store = {};
        },
      };
    })(),
  },
};

const storage = require('./storage');

describe('storage utility', () => {
  beforeEach(() => {
    // Clear the mock storage before each test
    chrome.storage.local.clear();
    // Clear mock function calls
    chrome.storage.local.get.mockClear();
    chrome.storage.local.set.mockClear();
    chrome.storage.local.remove.mockClear();
  });

  test('should save and load data correctly', async () => {
    const testKey = 'testKey';
    const testData = { id: 1, value: 'test' };

    await storage.save(testKey, testData);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ [testKey]: testData });

    const loadedData = await storage.load(testKey);
    expect(chrome.storage.local.get).toHaveBeenCalledWith([testKey]);
    expect(loadedData).toEqual(testData);
  });

  test('should return default value for a non-existent key', async () => {
    const defaultValue = { default: true };
    const loadedData = await storage.load('nonExistentKey', defaultValue);

    expect(loadedData).toEqual(defaultValue);
  });

  test('should remove data correctly', async () => {
    const testKey = 'testKey';
    const testData = { id: 2 };

    // Save data first
    await storage.save(testKey, testData);
    // Then remove it
    await storage.remove(testKey);
    expect(chrome.storage.local.remove).toHaveBeenCalledWith([testKey]);

    // Try to load it again, should be null
    const loadedData = await storage.load(testKey);
    expect(loadedData).toBeNull();
  });
});
