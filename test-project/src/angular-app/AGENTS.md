# Agent Instructions for Angular Application

## Overview
This is the root of the Angular application containing the main app structure.

## Folder Purpose
Contains the Angular application root, modules, routing configuration, and global services.

## Agent Instructions

### Code Style
- Follow Angular style guide conventions
- Use TypeScript strict mode
- Organize code by feature modules
- Use dependency injection for services

### Component Basics
```typescript
import { Component, OnInit } from '@angular/core';
import { UserService } from './services/user.service';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.scss']
})
export class UserListComponent implements OnInit {
  users: User[] = [];
  loading = false;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.userService.getUsers().subscribe({
      next: (users) => this.users = users,
      error: (error) => console.error(error),
      complete: () => this.loading = false
    });
  }
}
```

### Module Organization
- Feature modules for major features
- Shared module for reusable components
- Core module for singleton services
- Lazy load feature modules when possible

### RxJS Best Practices
- Always unsubscribe from subscriptions
- Use async pipe in templates when possible
- Use operators for data transformation
- Handle errors in observable streams

### Testing
- Write unit tests for components and services
- Use TestBed for component testing
- Mock dependencies with jasmine spies
- Test template bindings and interactions

<!-- PROJECT_SPECIFIC -->

## Project-Specific Notes

Add Angular-specific project details here.
