# Recipe: Handle User Entitlements

## Description
How to check and manage user entitlements (permissions and access control) using the internal EntitlementService.

## Prerequisites
- Access to EntitlementService API
- Authentication token for the requesting user
- Understanding of the entitlement hierarchy and roles
- Database access for entitlement caching (optional)

## Steps

### 1. Import Required Services

```typescript
import { EntitlementService } from '@company/entitlement-service';
import { AuthService } from '@company/auth-service';
```

### 2. Initialize the Service

```typescript
const entitlementService = new EntitlementService({
  apiUrl: process.env.ENTITLEMENT_API_URL,
  cacheEnabled: true,
  cacheTTL: 300 // Cache for 5 minutes
});
```

### 3. Check Basic Entitlement

```typescript
async function checkUserAccess(userId: string, resource: string, action: string): Promise<boolean> {
  try {
    const hasAccess = await entitlementService.hasEntitlement(userId, {
      resource, // e.g., 'documents'
      action    // e.g., 'read', 'write', 'delete'
    });

    if (!hasAccess) {
      logger.info('Access denied', { userId, resource, action });
    }

    return hasAccess;
  } catch (error) {
    logger.error('Entitlement check failed', { error, userId, resource, action });
    // Fail closed - deny access on errors
    return false;
  }
}
```

### 4. Use in API Middleware

```typescript
// Express middleware example
export function requireEntitlement(resource: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAccess = await checkUserAccess(userId, resource, action);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        required: { resource, action }
      });
    }

    next();
  };
}

// Usage in route
router.delete('/api/documents/:id',
  requireEntitlement('documents', 'delete'),
  deleteDocumentHandler
);
```

### 5. Check Multiple Entitlements

```typescript
async function checkMultipleEntitlements(
  userId: string,
  checks: Array<{ resource: string; action: string }>
): Promise<Record<string, boolean>> {
  const results = await Promise.all(
    checks.map(async ({ resource, action }) => {
      const hasAccess = await entitlementService.hasEntitlement(userId, { resource, action });
      return { key: `${resource}:${action}`, hasAccess };
    })
  );

  return results.reduce((acc, { key, hasAccess }) => {
    acc[key] = hasAccess;
    return acc;
  }, {} as Record<string, boolean>);
}

// Usage
const permissions = await checkMultipleEntitlements(userId, [
  { resource: 'documents', action: 'read' },
  { resource: 'documents', action: 'write' },
  { resource: 'users', action: 'manage' }
]);

console.log(permissions);
// { 'documents:read': true, 'documents:write': true, 'users:manage': false }
```

## Common Patterns

### Role-Based Access Control (RBAC)

```typescript
// Check if user has a specific role
async function hasRole(userId: string, role: string): Promise<boolean> {
  const userRoles = await entitlementService.getUserRoles(userId);
  return userRoles.includes(role);
}

// Check if user has any of the specified roles
async function hasAnyRole(userId: string, roles: string[]): Promise<boolean> {
  const userRoles = await entitlementService.getUserRoles(userId);
  return roles.some(role => userRoles.includes(role));
}

// Usage
if (await hasRole(userId, 'admin')) {
  // Allow admin operations
}

if (await hasAnyRole(userId, ['admin', 'moderator'])) {
  // Allow moderator operations
}
```

### Resource Ownership Check

```typescript
async function canAccessResource(
  userId: string,
  resourceType: string,
  resourceId: string,
  action: string
): Promise<boolean> {
  // Check if user owns the resource
  const resource = await db.query(
    `SELECT owner_id FROM ${resourceType} WHERE id = $1`,
    [resourceId]
  );

  if (resource.rows[0]?.owner_id === userId) {
    return true; // Owner has full access
  }

  // Check entitlements for non-owners
  return await entitlementService.hasEntitlement(userId, {
    resource: resourceType,
    action,
    resourceId // Check resource-specific permissions
  });
}
```

### Hierarchical Entitlements

```typescript
// Check if user has access to organization resources
async function checkOrganizationAccess(
  userId: string,
  organizationId: string,
  action: string
): Promise<boolean> {
  // Check organization-level entitlement
  return await entitlementService.hasEntitlement(userId, {
    resource: 'organization',
    action,
    scope: { organizationId }
  });
}

// Check if user has access to team resources within organization
async function checkTeamAccess(
  userId: string,
  teamId: string,
  action: string
): Promise<boolean> {
  const team = await db.getTeam(teamId);

  // Check team-level entitlement
  const hasTeamAccess = await entitlementService.hasEntitlement(userId, {
    resource: 'team',
    action,
    scope: { teamId }
  });

  if (hasTeamAccess) return true;

  // Fallback to organization-level check
  return await checkOrganizationAccess(userId, team.organizationId, action);
}
```

## Caching Strategy

```typescript
import { LRUCache } from 'lru-cache';

// In-memory cache for entitlement checks
const entitlementCache = new LRUCache<string, boolean>({
  max: 10000,
  ttl: 1000 * 60 * 5 // 5 minutes
});

async function checkUserAccessWithCache(
  userId: string,
  resource: string,
  action: string
): Promise<boolean> {
  const cacheKey = `${userId}:${resource}:${action}`;

  // Check cache first
  const cached = entitlementCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  // Fetch from service
  const hasAccess = await entitlementService.hasEntitlement(userId, { resource, action });

  // Cache the result
  entitlementCache.set(cacheKey, hasAccess);

  return hasAccess;
}

// Invalidate cache when entitlements change
export function invalidateUserCache(userId: string) {
  for (const key of entitlementCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      entitlementCache.delete(key);
    }
  }
}
```

## Error Handling

```typescript
async function safeEntitlementCheck(
  userId: string,
  resource: string,
  action: string,
  options = { failOpen: false }
): Promise<boolean> {
  try {
    return await entitlementService.hasEntitlement(userId, { resource, action });
  } catch (error) {
    logger.error('Entitlement check failed', {
      error: error.message,
      userId,
      resource,
      action
    });

    // Fail open vs fail closed
    if (options.failOpen) {
      logger.warn('Failing open - allowing access due to error');
      return true;
    }

    // Fail closed by default - deny access
    return false;
  }
}
```

## Related Services

- **AuthService**: User authentication and session management
- **RoleService**: Role management and assignment
- **AuditService**: Log access attempts for compliance
- **CacheService**: Distributed caching for entitlement data

## Monitoring

```typescript
// Track entitlement checks
await metrics.increment('entitlements.check', {
  resource,
  action,
  result: hasAccess ? 'granted' : 'denied'
});

// Track cache hit rates
const cacheHitRate = entitlementCache.hits / (entitlementCache.hits + entitlementCache.misses);
await metrics.gauge('entitlements.cache_hit_rate', cacheHitRate);

// Alert on high denial rates
if (denialRate > 0.5) {
  await alertService.send({
    severity: 'info',
    message: 'High entitlement denial rate detected'
  });
}
```

## Testing

```typescript
describe('Entitlement checks', () => {
  let mockEntitlementService: jest.Mocked<EntitlementService>;

  beforeEach(() => {
    mockEntitlementService = {
      hasEntitlement: jest.fn()
    } as any;
  });

  it('should grant access when user has entitlement', async () => {
    mockEntitlementService.hasEntitlement.mockResolvedValue(true);

    const hasAccess = await checkUserAccess('user123', 'documents', 'read');

    expect(hasAccess).toBe(true);
  });

  it('should deny access when entitlement check fails', async () => {
    mockEntitlementService.hasEntitlement.mockRejectedValue(new Error('Service unavailable'));

    const hasAccess = await checkUserAccess('user123', 'documents', 'read');

    expect(hasAccess).toBe(false); // Fail closed
  });
});
```

## Best Practices

1. **Fail closed by default** - Deny access on errors unless explicitly configured otherwise
2. **Cache entitlement checks** - Reduce latency and service load
3. **Invalidate cache on changes** - Clear cache when roles/permissions are modified
4. **Log access denials** - Track denied access attempts for security
5. **Use middleware** - Centralize entitlement checks in route middleware
6. **Check at multiple levels** - Verify access at API, service, and data layers
7. **Test with different roles** - Ensure proper access control in tests
8. **Monitor performance** - Track cache hit rates and check latency
