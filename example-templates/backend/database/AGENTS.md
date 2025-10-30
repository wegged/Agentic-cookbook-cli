# Agent Instructions for Database Layer

## Overview
This folder contains database schemas, migrations, and data access logic.

## Folder Purpose
Database models, migration scripts, seeders, and repository/DAO patterns live here. This is the persistence layer of the application.

## Agent Instructions

### Code Style
- Use meaningful table and column names
- Follow naming conventions (snake_case for PostgreSQL, camelCase for MongoDB)
- Always include timestamps (created_at, updated_at)
- Use UUID or auto-increment IDs consistently

### Database Migrations
```sql
-- Migration: 20240101_create_users_table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

### Query Guidelines
- Use parameterized queries to prevent SQL injection
- Add indexes for frequently queried columns
- Use transactions for multi-step operations
- Implement connection pooling
- Set appropriate query timeouts

### Repository Pattern
```typescript
class UserRepository {
  async findById(id: string): Promise<User | null> {
    const result = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async create(userData: CreateUserDTO): Promise<User> {
    const result = await db.query(
      'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [userData.email, userData.username, userData.passwordHash]
    );
    return result.rows[0];
  }
}
```

### Data Validation
- Validate data before inserting/updating
- Use database constraints for data integrity
- Handle unique constraint violations gracefully

### Testing Requirements
- Write unit tests for repository methods
- Use test database or transactions for isolation
- Test edge cases (null values, large datasets)
- Verify constraint enforcement

### Performance
- Use database indexes strategically
- Avoid N+1 query problems
- Use batch operations where possible
- Monitor slow queries
- Consider read replicas for heavy read workloads

### Migration Best Practices
- Never modify existing migrations
- Always provide rollback/down migrations
- Test migrations on staging before production
- Use version control for migration files
- Document breaking changes

<!-- PROJECT_SPECIFIC -->

## Project-Specific Notes

Add your database-specific information:
- Connection details and environment variables
- Specific ORM configuration
- Custom query patterns
- Backup and recovery procedures
