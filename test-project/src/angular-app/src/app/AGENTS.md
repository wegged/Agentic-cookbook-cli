# Agent Instructions for Angular App Module

## Overview
Contains the root application module and main component.

## Folder Purpose
App module, routing, and root component configuration.

## Agent Instructions

### App Module Structure
- Import and declare root components
- Configure providers for global services
- Set up routing module
- Import feature modules

### Routing
```typescript
const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'users', loadChildren: () => import('./users/users.module').then(m => m.UsersModule) },
  { path: '**', component: NotFoundComponent }
];
```

<!-- PROJECT_SPECIFIC -->

## Project-Specific Notes

Add app module configuration notes here.
