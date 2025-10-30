# Agent Instructions for Angular Services

## Overview
Injectable services for business logic and data management.

## Folder Purpose
Services, HTTP clients, and state management.

## Agent Instructions

### Service Pattern
```typescript
@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'https://api.example.com/users';

  constructor(private http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  getUser(id: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  updateUser(id: string, data: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, data);
  }
}
```

### Best Practices
- Use providedIn: 'root' for singleton services
- Handle errors with catchError operator
- Use BehaviorSubject for stateful services
- Implement proper TypeScript typing

<!-- PROJECT_SPECIFIC -->

## Project-Specific Notes

Add service-specific configuration here.
