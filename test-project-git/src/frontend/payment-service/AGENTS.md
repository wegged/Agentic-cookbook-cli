# Agent Instructions for React Frontend

## Overview
This folder contains React components, hooks, and frontend application logic.

## Folder Purpose
React components, custom hooks, context providers, and UI logic live here. This is the user-facing layer of the application.

## Agent Instructions

### Code Style
- Use functional components with hooks
- Follow naming conventions: PascalCase for components, camelCase for functions/hooks
- Keep components small and focused (Single Responsibility)
- Use TypeScript for type safety

### Component Structure
```typescript
import React, { useState, useEffect } from 'react';

interface UserProfileProps {
  userId: string;
  onUpdate?: (user: User) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId, onUpdate }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId).then(setUser).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <LoadingSpinner />;
  if (!user) return <ErrorMessage message="User not found" />;

  return (
    <div className="user-profile">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
};
```

### State Management
- Use useState for local component state
- Use useContext for shared state across components
- Consider Redux/Zustand for complex global state
- Keep state as close to where it's used as possible

### Custom Hooks
```typescript
// useUser.ts
export function useUser(userId: string) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchUser(userId)
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [userId]);

  return { user, loading, error };
}
```

### Performance Optimization
- Use React.memo() for expensive components
- Use useMemo() and useCallback() to prevent unnecessary re-renders
- Lazy load routes and heavy components
- Implement virtual scrolling for long lists

### Testing Requirements
- Write unit tests for components using React Testing Library
- Test user interactions and state changes
- Mock API calls in tests
- Aim for high test coverage on critical paths

### Accessibility
- Use semantic HTML elements
- Add ARIA labels where needed
- Ensure keyboard navigation works
- Test with screen readers

### Error Handling
- Use Error Boundaries for component-level errors
- Show user-friendly error messages
- Log errors to monitoring service
- Provide recovery options when possible

### API Integration
- Use custom hooks for API calls
- Handle loading and error states
- Implement retry logic for failed requests
- Cache responses when appropriate

<!-- PROJECT_SPECIFIC -->

## Project-Specific Notes

Add your React-specific guidelines:
- Styling approach (CSS modules, styled-components, Tailwind)
- State management library in use
- Custom component patterns
- Design system references
