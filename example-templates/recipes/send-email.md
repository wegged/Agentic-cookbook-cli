# Recipe: Send Email Using Internal Email Service

## Description
How to send emails using the internal email service with proper formatting, tracking, and error handling.

## Prerequisites
- Access to EmailService API
- Valid API key in environment variables (`EMAIL_API_KEY`)
- Email templates repository available
- Node.js email service package installed

## Steps

### 1. Import the Email Service

```typescript
import { EmailService } from '@company/email-service';
import { EmailTemplate } from '@company/email-templates';
```

### 2. Initialize the Service

```typescript
const emailService = new EmailService({
  apiKey: process.env.EMAIL_API_KEY,
  environment: process.env.NODE_ENV,
  timeout: 10000, // 10 seconds
  retries: 3
});
```

### 3. Prepare Email Data

```typescript
const emailData = {
  to: 'user@example.com',
  from: 'noreply@company.com',
  subject: 'Welcome to Our Platform',
  template: 'welcome-email', // Template name
  variables: {
    userName: 'John Doe',
    activationLink: generateActivationLink(userId),
    supportEmail: 'support@company.com'
  },
  tags: ['onboarding', 'user-activation'] // For tracking
};
```

### 4. Send Email with Error Handling

```typescript
try {
  const result = await emailService.send(emailData);

  // Log success for tracking
  logger.info('Email sent successfully', {
    messageId: result.messageId,
    recipient: emailData.to,
    template: emailData.template
  });

  // Store message ID for tracking opens/clicks
  await db.saveEmailLog({
    userId,
    messageId: result.messageId,
    template: emailData.template,
    sentAt: new Date()
  });

  return result;
} catch (error) {
  // Log error with context
  logger.error('Email sending failed', {
    error: error.message,
    recipient: emailData.to,
    template: emailData.template
  });

  // Queue for retry if temporary failure
  if (error.code === 'TEMPORARY_FAILURE') {
    await emailQueue.add(emailData, { delay: 60000 }); // Retry in 1 minute
  }

  throw error;
}
```

## Common Patterns

### Transactional Emails
Use templates from `templates/transactional/`:
- Order confirmations
- Password resets
- Account notifications
- Payment receipts

```typescript
const transactionalEmail = {
  to: user.email,
  template: 'password-reset',
  variables: {
    resetLink: generateResetLink(user.id, resetToken),
    expiresIn: '1 hour'
  },
  priority: 'high' // Transactional emails get priority
};
```

### Marketing Emails
Require opt-in check first:

```typescript
// Check if user opted in for marketing emails
const canSendMarketing = await userService.hasMarketingConsent(userId);

if (!canSendMarketing) {
  logger.warn('User has not opted in for marketing emails', { userId });
  return;
}

await emailService.send({
  to: user.email,
  template: 'monthly-newsletter',
  variables: { month: 'December', highlights: [...] },
  unsubscribeLink: generateUnsubscribeLink(userId),
  tags: ['marketing', 'newsletter']
});
```

### Bulk Emails
Use batch sending for multiple recipients:

```typescript
const recipients = await userService.getActiveUsers();

// Batch send in groups of 100
const batchSize = 100;
for (let i = 0; i < recipients.length; i += batchSize) {
  const batch = recipients.slice(i, i + batchSize);

  await emailService.sendBatch(
    batch.map(user => ({
      to: user.email,
      template: 'weekly-update',
      variables: { userName: user.name, ... }
    }))
  );

  // Rate limiting - wait between batches
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

## Error Handling Strategies

### Retry Logic
```typescript
async function sendEmailWithRetry(emailData: EmailData, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await emailService.send(emailData);
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries && error.code === 'TEMPORARY_FAILURE') {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
```

### Fallback Strategy
```typescript
try {
  await primaryEmailService.send(emailData);
} catch (error) {
  logger.warn('Primary email service failed, using fallback', { error });
  await fallbackEmailService.send(emailData);
}
```

## Related Services

- **Tracking Service**: Log email opens and clicks for analytics
- **Template Service**: Manage and version email templates
- **User Preferences Service**: Check email opt-out status
- **Queue Service**: Handle email retries and rate limiting

## Monitoring and Observability

```typescript
// Track email metrics
await metrics.increment('emails.sent', {
  template: emailData.template,
  status: 'success'
});

// Monitor delivery rates
await metrics.gauge('emails.delivery_rate', deliveryRate);

// Alert on high failure rates
if (failureRate > 0.1) { // 10% failure rate
  await alertService.send({
    severity: 'warning',
    message: 'High email failure rate detected'
  });
}
```

## Examples

See `examples/email-service/` for complete working examples:
- `transactional-email.ts` - Order confirmation example
- `marketing-campaign.ts` - Newsletter sending example
- `bulk-email.ts` - Batch sending example
- `email-with-attachments.ts` - Sending files via email

## Configuration

Environment variables required:
```bash
EMAIL_API_KEY=your_api_key_here
EMAIL_FROM_ADDRESS=noreply@company.com
EMAIL_REPLY_TO=support@company.com
EMAIL_SERVICE_URL=https://email-api.company.com
```

## Best Practices

1. **Always validate email addresses** before sending
2. **Use templates** instead of hard-coding email content
3. **Include unsubscribe links** in marketing emails (legal requirement)
4. **Monitor bounce rates** and remove invalid emails
5. **Respect user preferences** - check opt-out status
6. **Use proper email authentication** (SPF, DKIM, DMARC)
7. **Test emails** in development environment first
8. **Track delivery metrics** for monitoring
