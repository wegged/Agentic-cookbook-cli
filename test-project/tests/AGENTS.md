# Agent Instructions for Testing

## Overview
This folder contains test files, fixtures, and testing utilities.

## Folder Purpose
Unit tests, integration tests, end-to-end tests, and test helpers live here.

## Agent Instructions

### Code Style
- One test file per source file (e.g., user.service.ts → user.service.test.ts)
- Use descriptive test names that explain what is being tested
- Follow AAA pattern: Arrange, Act, Assert
- Keep tests focused and independent

### Test Structure
```typescript
describe('UserService', () => {
  let service: UserService;
  let mockDb: jest.Mocked<Database>;

  beforeEach(() => {
    mockDb = createMockDatabase();
    service = new UserService(mockDb);
  });

  describe('getUser', () => {
    it('should return user when found', async () => {
      // Arrange
      const userId = '123';
      const expectedUser = { id: userId, name: 'John' };
      mockDb.query.mockResolvedValue({ rows: [expectedUser] });

      // Act
      const result = await service.getUser(userId);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
    });

    it('should return null when user not found', async () => {
      // Arrange
      mockDb.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await service.getUser('999');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Arrange
      mockDb.query.mockRejectedValue(new Error('Connection failed'));

      // Act & Assert
      await expect(service.getUser('123')).rejects.toThrow('Connection failed');
    });
  });
});
```

### Testing Patterns
- **Unit Tests**: Test individual functions/classes in isolation
- **Integration Tests**: Test multiple components working together
- **E2E Tests**: Test complete user workflows
- **Mock external dependencies**: APIs, databases, file system

### Coverage Goals
- Aim for 80%+ code coverage
- Focus on critical business logic
- Test edge cases and error scenarios
- Don't test framework code

### Test Data
- Use factories or fixtures for test data
- Keep test data realistic but minimal
- Avoid hard-coding test data in tests
- Clean up test data after each test

### Mocking Best Practices
```typescript
// Mock external API
jest.mock('./api-client', () => ({
  fetchUser: jest.fn()
}));

// Mock with implementation
const mockFetchUser = fetchUser as jest.MockedFunction<typeof fetchUser>;
mockFetchUser.mockResolvedValue({ id: '1', name: 'John' });
```

### Async Testing
```typescript
// Using async/await
it('should fetch user data', async () => {
  const user = await service.getUser('123');
  expect(user).toBeDefined();
});

// Using done callback (when needed)
it('should handle callbacks', (done) => {
  service.getUserCallback('123', (err, user) => {
    expect(err).toBeNull();
    expect(user).toBeDefined();
    done();
  });
});
```

### Common Test Utilities
```typescript
// Test helper for creating users
export function createTestUser(overrides?: Partial<User>): User {
  return {
    id: '123',
    name: 'Test User',
    email: 'test@example.com',
    ...overrides
  };
}

// Test helper for setting up mock database
export function createMockDatabase(): jest.Mocked<Database> {
  return {
    query: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
  } as any;
}
```

<!-- PROJECT_SPECIFIC -->

## Project-Specific Notes

Add testing framework specifics:
- Testing framework in use (Jest, Mocha, etc.)
- Test runner configuration
- CI/CD integration details
- Code coverage requirements
