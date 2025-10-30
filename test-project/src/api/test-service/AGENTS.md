# Agent Instructions for Backend API

## Overview
This folder contains the REST API endpoints and request handlers for the backend service.

## Folder Purpose
API routes, controllers, middleware, and request/response handling logic live here. This is the entry point for all HTTP requests to the backend.

## Agent Instructions

### Code Style
- Use async/await for all asynchronous operations
- Follow RESTful naming conventions for endpoints
- Use HTTP status codes appropriately (200, 201, 400, 404, 500, etc.)
- Keep route handlers thin - delegate business logic to services

### API Endpoint Structure
```typescript
// Route definition
router.get('/api/users/:id', validateAuth, getUserHandler);

// Handler implementation
async function getUserHandler(req: Request, res: Response) {
  try {
    const userId = req.params.id;
    const user = await userService.getUser(userId);
    res.json({ data: user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

### Request Validation
- Validate all input using validation middleware
- Sanitize user input to prevent injection attacks
- Return clear error messages for validation failures

### Error Handling
- Always wrap async handlers with try-catch
- Use centralized error handling middleware
- Log errors with context (user ID, request ID, etc.)
- Return consistent error response format:
  ```json
  {
    "error": "Error message",
    "code": "ERROR_CODE",
    "details": {}
  }
  ```

### Authentication & Authorization
- Use JWT tokens for authentication
- Validate tokens on protected routes
- Check user permissions before allowing operations
- Return 401 for authentication failures, 403 for authorization failures

### Testing Requirements
- Write integration tests for all endpoints
- Test both success and error cases
- Mock external service calls
- Test authentication and authorization flows

### Dependencies
- Express.js or Fastify for routing
- Validation library (Joi, Zod, etc.)
- Authentication middleware
- Service layer modules

### Common Patterns
- Controller → Service → Repository pattern
- Dependency injection for testability
- Middleware composition for cross-cutting concerns
- Response transformation/serialization

### Performance Considerations
### Rate Limiting
- Implement rate limiting for all public endpoints
- Use Redis for distributed rate limiting
- Return 429 Too Many Requests when limit exceeded

- Use pagination for list endpoints
- Implement caching for frequently accessed data
- Add request timeouts
- Monitor response times and add logging

<!-- PROJECT_SPECIFIC -->

## Project-Specific Notes

Add your project-specific API guidelines here:
- Custom authentication requirements
- Specific middleware usage
- Team conventions
- Local development setup


<!-- PROJECT_SPECIFIC -->

## Project-Specific Notes

### Our Custom Setup
- We use PostgreSQL 14
- Connection string from environment variable DB_URL
- We have custom rate limiting middleware