# OpenAI API Setup Guide

This guide will help you set up and use the OpenAI API client for bulk processing tasks.

## Setup Steps

### 1. Get Your OpenAI API Key

1. Visit https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (it starts with `sk-`)

### 2. Add API Key to .env

Add this line to your `.env` file in the project root:

```bash
OPENAI_API_KEY=sk-your-actual-api-key-here
```

Your `.env` file should now look like:

```bash
BUTTONDOWN_API_KEY=882784e8-a6f6-4b4f-afdb-47943a841dbd
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. Verify Installation

The OpenAI SDK is already installed. You can verify by running:

```bash
npm list openai
```

## Quick Start

### Basic Usage

Create a new script or add to an existing one:

```typescript
import 'dotenv/config';
import { OpenAIClient } from './lib/api/openai-client.js';

const client = new OpenAIClient(process.env.OPENAI_API_KEY!);

// Simple completion
const response = await client.createChatCompletion({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(client.extractContent(response));
```

### Run Examples

To see all available features:

```bash
npm run openai:examples
```

Edit `scripts/example-openai-usage.ts` and uncomment the examples you want to try.

## Common Use Cases

### 1. Email Summarization

Process all your emails and generate summaries:

```typescript
import { db } from './lib/db/schema.js';
import { OpenAIClient } from './lib/api/openai-client.js';

const client = new OpenAIClient(process.env.OPENAI_API_KEY!);

// Get emails from database
const emails = db.prepare('SELECT * FROM emails LIMIT 10').all();

const result = await client.processBatch(
  emails,
  async (email: any) => {
    const response = await client.createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Summarize this email in 2-3 sentences:\n\nSubject: ${email.subject}\n\n${email.body}`,
        },
      ],
      max_tokens: 150,
    });
    return {
      id: email.id,
      subject: email.subject,
      summary: client.extractContent(response),
    };
  },
  {
    concurrency: 5,
    delayMs: 200,
    onProgress: (completed, total) => {
      console.log(`Progress: ${completed}/${total}`);
    },
  }
);

console.log(`Summarized ${result.successful.length} emails`);
result.successful.forEach(({ result: summary }) => {
  console.log(`\n${summary.subject}:`);
  console.log(summary.summary);
});
```

### 2. Content Classification

Classify or tag content:

```typescript
const result = await client.processBatch(
  emails,
  async (email: any) => {
    const response = await client.createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Classify this email into one of these categories: Technical, Personal, Business, Newsletter, Marketing, Other.
        
Email: ${email.subject}

Reply with just the category name.`,
        },
      ],
      max_tokens: 10,
    });
    return {
      id: email.id,
      category: client.extractContent(response),
    };
  },
  { concurrency: 10 }
);
```

### 3. Bulk Content Generation

Generate content for multiple items:

```typescript
const topics = ['AI', 'Quantum Computing', 'Space Exploration'];

const result = await client.processBatch(
  topics,
  async (topic) => {
    const response = await client.createChatCompletion({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'user',
          content: `Write a brief introduction about ${topic} for a newsletter.`,
        },
      ],
      max_tokens: 200,
    });
    return client.extractContent(response);
  },
  { concurrency: 3 }
);
```

### 4. Sequential Processing with Dependencies

When each item depends on the previous result:

```typescript
const result = await client.processSequential(items, async (item, index) => {
  // Process one at a time
  const response = await client.createChatCompletion({
    model: 'gpt-5-mini',
    messages: [{ role: 'user', content: item.prompt }],
  });
  return client.extractContent(response);
});
```

## Model Options

### Recommended Models (GPT-5 Generation)

- **`gpt-5-mini`**: Fast, cost-effective, great for most bulk tasks ($0.05 input / $0.40 output per 1M tokens)
- **`gpt-5-nano`**: Mid-tier option with balanced performance ($0.25 input / $2.00 output per 1M tokens)
- **`gpt-5`**: Most capable, expert-level reasoning ($1.25 input / $10.00 output per 1M tokens)

### Legacy Models (Still Available)

- **`gpt-4o`**: Previous generation flagship ($2.50 input / $10.00 output per 1M tokens)
- **`gpt-4-turbo`**: Older but capable ($10 per 1M input tokens)
- **`gpt-3.5-turbo`**: Legacy model ($0.50 per 1M input tokens)

**For bulk processing, `gpt-5-mini` is the best choice** - it's faster and cheaper than GPT-4 models while providing enhanced reasoning from the GPT-5 architecture.

## Rate Limits

OpenAI has rate limits based on your account tier:

- **Free tier**: 3 RPM (requests per minute)
- **Tier 1**: 500 RPM
- **Tier 2**: 5,000 RPM
- **Tier 5**: 10,000 RPM

Use the `concurrency` option to control your request rate:

```typescript
// For free tier (3 RPM = ~1 every 20 seconds)
{ concurrency: 1, delayMs: 20000 }

// For Tier 1 (500 RPM = ~8 per second)
{ concurrency: 5, delayMs: 600 }

// For higher tiers
{ concurrency: 10, delayMs: 100 }
```

## Cost Estimation

Estimate costs before running bulk operations:

```typescript
// Example: 1,000 emails, average 500 tokens each
// Input: 1,000 * 500 = 500,000 tokens
// Output: 1,000 * 100 = 100,000 tokens (estimated)
//
// With gpt-5-mini:
// Input: 500k tokens * $0.05/1M = $0.025
// Output: 100k tokens * $0.40/1M = $0.040
// Total: ~$0.07 for 1,000 emails (50% cheaper than GPT-4o-mini!)
//
// With gpt-5:
// Input: 500k tokens * $1.25/1M = $0.625
// Output: 100k tokens * $10.00/1M = $1.000
// Total: ~$1.63 for 1,000 emails (more expensive but expert-level quality)
```

## Error Handling

The client automatically handles:

- Rate limiting with retries
- Network errors with exponential backoff
- Individual item failures in batch processing

```typescript
const result = await client.processBatch(items, processor, {
  onError: (error, item, index) => {
    console.error(`Failed item ${index}:`, error.message);
    // Log to database, save for retry, etc.
  },
});

// Check results
console.log(`Success: ${result.successful.length}`);
console.log(`Failed: ${result.failed.length}`);

// Retry failed items
if (result.failed.length > 0) {
  const retryItems = result.failed.map((f) => f.item);
  const retryResult = await client.processBatch(retryItems, processor);
}
```

## Advanced Features

### Access Raw OpenAI Client

For other API endpoints (embeddings, images, audio):

```typescript
const rawClient = client.getRawClient();

// Generate embeddings
const embedding = await rawClient.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'Your text here',
});

// Generate images
const image = await rawClient.images.generate({
  model: 'dall-e-3',
  prompt: 'A beautiful landscape',
});

// Transcribe audio
const transcription = await rawClient.audio.transcriptions.create({
  file: fs.createReadStream('audio.mp3'),
  model: 'whisper-1',
});
```

### Streaming Responses

For real-time output:

```typescript
const stream = await client.createChatCompletionStream({
  model: 'gpt-5-mini',
  messages: [{ role: 'user', content: 'Write a story' }],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || '';
  process.stdout.write(content);
}
```

## Best Practices

1. **Start Small**: Test with a small batch first
2. **Monitor Costs**: Check your usage at https://platform.openai.com/usage
3. **Use Appropriate Models**: Start with `gpt-5-mini` for bulk tasks, upgrade to `gpt-5` only if needed
4. **Set Token Limits**: Use `max_tokens` to control output length and costs
5. **Handle Errors**: Always implement `onError` callback for production use
6. **Be Respectful**: Use appropriate concurrency for your tier
7. **Cache Results**: Save processed results to avoid reprocessing
8. **Leverage GPT-5**: The new models provide better reasoning at lower costs than GPT-4

## Troubleshooting

### "Invalid API Key" Error

- Make sure your API key starts with `sk-`
- Check that `.env` file is in the project root
- Verify the key is correct at https://platform.openai.com/api-keys

### Rate Limit Errors

- Reduce `concurrency` value
- Increase `delayMs` value
- Check your rate limits at https://platform.openai.com/account/limits

### High Costs

- Use `gpt-5-mini` instead of larger models (50% cheaper than GPT-4o-mini)
- Set `max_tokens` to limit output length
- Add better prompts to avoid unnecessary regenerations
- Consider `gpt-5-nano` for mid-tier needs

## Further Reading

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [OpenAI Node.js Library](https://github.com/openai/openai-node)
- [Rate Limits](https://platform.openai.com/docs/guides/rate-limits)
- [Pricing](https://openai.com/api/pricing/)
