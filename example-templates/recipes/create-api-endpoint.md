# Recipe: Create API Endpoint

## Description
Step-by-step guide for creating a new REST API endpoint following company standards and best practices.

## Prerequisites
- Express.js or Fastify server setup
- Database connection configured
- Authentication middleware available
- Understanding of REST principles

## Steps

### 1. Define the Route

```typescript
// routes/users.routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import * as userController from '../controllers/user.controller';
import { createUserSchema } from '../schemas/user.schema';

const router = Router();

// POST /api/users - Create new user
router.post('/users',
  authenticate,
  validateRequest(createUserSchema),
  userController.createUser
);

export default router;
```

### 2. Create Request Validation Schema

```typescript
// schemas/user.schema.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username must be less than 50 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
    name: z.string().optional()
  })
});

export type CreateUserRequest = z.infer<typeof createUserSchema>;
```

### 3. Implement Controller

```typescript
// controllers/user.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service';
import { CreateUserRequest } from '../schemas/user.schema';
import { logger } from '../utils/logger';

export async function createUser(
  req: Request<{}, {}, CreateUserRequest['body']>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userData = req.body;

    logger.info('Creating new user', { email: userData.email });

    // Call service layer
    const user = await userService.createUser(userData);

    // Return 201 Created with location header
    res.status(201)
      .location(`/api/users/${user.id}`)
      .json({
        data: user,
        message: 'User created successfully'
      });

  } catch (error) {
    next(error); // Pass to error handling middleware
  }
}
```

### 4. Implement Service Layer

```typescript
// services/user.service.ts
import * as userRepository from '../repositories/user.repository';
import { hashPassword } from '../utils/crypto';
import { ConflictError } from '../errors';

interface CreateUserData {
  email: string;
  username: string;
  password: string;
  name?: string;
}

export async function createUser(userData: CreateUserData) {
  // Check if user already exists
  const existingUser = await userRepository.findByEmail(userData.email);
  if (existingUser) {
    throw new ConflictError('User with this email already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(userData.password);

  // Create user
  const user = await userRepository.create({
    email: userData.email,
    username: userData.username,
    passwordHash,
    name: userData.name
  });

  // Don't return password hash
  const { passwordHash: _, ...userWithoutPassword } = user;

  return userWithoutPassword;
}
```

### 5. Implement Repository Layer

```typescript
// repositories/user.repository.ts
import { db } from '../database';
import { User } from '../types';

export async function findByEmail(email: string): Promise<User | null> {
  const result = await db.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

export async function create(userData: {
  email: string;
  username: string;
  passwordHash: string;
  name?: string;
}): Promise<User> {
  const result = await db.query(
    `INSERT INTO users (email, username, password_hash, name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, username, name, created_at, updated_at`,
    [userData.email, userData.username, userData.passwordHash, userData.name]
  );

  return result.rows[0];
}
```

### 6. Add Error Handling

```typescript
// middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error with context
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });

  // Handle specific error types
  if (error.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation failed',
      details: error.message
    });
    return;
  }

  if (error.name === 'ConflictError') {
    res.status(409).json({
      error: error.message
    });
    return;
  }

  if (error.name === 'UnauthorizedError') {
    res.status(401).json({
      error: 'Authentication required'
    });
    return;
  }

  // Default to 500 Internal Server Error
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
}
```

### 7. Write Tests

```typescript
// controllers/user.controller.test.ts
import request from 'supertest';
import { app } from '../app';
import * as userService from '../services/user.service';

jest.mock('../services/user.service');

describe('POST /api/users', () => {
  const mockCreateUser = userService.createUser as jest.MockedFunction<typeof userService.createUser>;

  it('should create user and return 201', async () => {
    const newUser = {
      id: '123',
      email: 'test@example.com',
      username: 'testuser',
      name: 'Test User',
      createdAt: new Date()
    };

    mockCreateUser.mockResolvedValue(newUser);

    const response = await request(app)
      .post('/api/users')
      .send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test123!',
        name: 'Test User'
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual(newUser);
    expect(response.headers.location).toBe('/api/users/123');
  });

  it('should return 400 for invalid email', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        email: 'invalid-email',
        username: 'testuser',
        password: 'Test123!'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('email');
  });

  it('should return 409 when user already exists', async () => {
    mockCreateUser.mockRejectedValue(new ConflictError('User already exists'));

    const response = await request(app)
      .post('/api/users')
      .send({
        email: 'existing@example.com',
        username: 'existing',
        password: 'Test123!'
      });

    expect(response.status).toBe(409);
  });
});
```

## Common Patterns

### Pagination

```typescript
export const listUsersSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
    sort: z.enum(['createdAt', 'name', 'email']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc')
  })
});

export async function listUsers(req: Request, res: Response): Promise<void> {
  const { page, limit, sort, order } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const [users, total] = await Promise.all([
    userService.listUsers({ offset, limit, sort, order }),
    userService.countUsers()
  ]);

  res.json({
    data: users,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit))
    }
  });
}
```

### Filtering

```typescript
router.get('/users',
  authenticate,
  validateRequest(filterUsersSchema),
  userController.filterUsers
);

export const filterUsersSchema = z.object({
  query: z.object({
    role: z.enum(['admin', 'user', 'moderator']).optional(),
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
    search: z.string().optional()
  })
});
```

## Related Services

- **Express**: Web framework
- **ValidationService**: Request validation
- **AuthService**: Authentication
- **DatabaseService**: Data persistence

## Best Practices

1. **Use proper HTTP status codes** (200, 201, 400, 401, 403, 404, 500)
2. **Validate all input** at the route level
3. **Separate concerns** (Controller → Service → Repository)
4. **Return consistent response formats**
5. **Add proper error handling** with meaningful messages
6. **Write integration tests** for all endpoints
7. **Use TypeScript** for type safety
8. **Log requests** for debugging and monitoring
9. **Implement rate limiting** for public endpoints
10. **Document with OpenAPI/Swagger**
