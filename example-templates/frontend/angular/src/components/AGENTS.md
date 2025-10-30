# Agent Instructions for Angular Components

## Overview
Reusable UI components for the Angular application.

## Folder Purpose
Shared and feature-specific components.

## Agent Instructions

### Component Design
- Keep components focused and reusable
- Use @Input() for data flow down
- Use @Output() for events up
- Implement OnChanges for complex input handling

### Example Component
```typescript
@Component({
  selector: 'app-user-card',
  template: `
    <div class="user-card">
      <h3>{{ user.name }}</h3>
      <button (click)="onEdit()">Edit</button>
    </div>
  `
})
export class UserCardComponent {
  @Input() user!: User;
  @Output() edit = new EventEmitter<User>();

  onEdit(): void {
    this.edit.emit(this.user);
  }
}
```

<!-- PROJECT_SPECIFIC -->

## Project-Specific Notes

Add component-specific guidelines here.
