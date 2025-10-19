# API Clients

This directory contains API client implementations for external services.

## OpenAI Client

A robust TypeScript client for the OpenAI API with support for bulk processing, streaming, and error handling.

### Setup

1. **Install dependencies** (already done):

   ```bash
   npm install openai dotenv
   ```

2. **Add your API key** to `.env`:

   ```bash
   OPENAI_API_KEY=sk-your-api-key-here
   ```

   Get your API key from: https://platform.openai.com/api-keys

### Basic Usage

```typescript
import 'dotenv/config';
import { OpenAIClient } from './lib/api/openai-client.js';

const client = new OpenAIClient(process.env.OPENAI_API_KEY!);

// Simple chat completion
const response = await client.createChatCompletion({
  model: 'gpt-5-mini',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
  ],
});

console.log(client.extractContent(response));
```

### Bulk Processing

Process multiple items with controlled concurrency and progress tracking:

```typescript
const emails = await loadEmails();

const result = await client.processBatch(
  emails,
  async (email) => {
    const response = await client.createChatCompletion({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'user',
          content: `Summarize: ${email.body}`,
        },
      ],
    });
    return client.extractContent(response);
  },
  {
    concurrency: 5, // Process 5 items at a time
    delayMs: 100, // Wait 100ms between batches
    onProgress: (completed, total) => {
      console.log(`Progress: ${completed}/${total}`);
    },
    onError: (error, item) => {
      console.error(`Failed:`, error.message);
    },
  }
);

console.log(`Successful: ${result.successful.length}`);
console.log(`Failed: ${result.failed.length}`);
```

### Streaming

Stream responses for real-time output:

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

### Advanced Features

Access the raw OpenAI client for other API endpoints:

```typescript
const rawClient = client.getRawClient();

// Embeddings
const embedding = await rawClient.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'Some text',
});

// Images
const image = await rawClient.images.generate({
  model: 'dall-e-3',
  prompt: 'A beautiful sunset',
});

// Audio
const transcription = await rawClient.audio.transcriptions.create({
  file: audioFile,
  model: 'whisper-1',
});
```

### Examples

Run the example script to see all features in action:

```bash
npm run openai:examples
```

Edit `scripts/example-openai-usage.ts` to uncomment specific examples you want to run.

### API Methods

#### `createChatCompletion(params)`

Create a chat completion with the specified parameters.

#### `createChatCompletionStream(params)`

Create a streaming chat completion.

#### `processBatch(items, processor, options)`

Process multiple items with controlled concurrency.

**Options:**

- `concurrency`: Number of concurrent requests (default: 5)
- `delayMs`: Delay between batches in ms (default: 0)
- `onProgress`: Progress callback `(completed, total, item?) => void`
- `onError`: Error callback `(error, item, index) => void`

#### `processSequential(items, processor, options)`

Process items one at a time (sequential processing).

#### `extractContent(completion)`

Extract text content from a completion response.

#### `getRawClient()`

Get the underlying OpenAI client for advanced operations.

## Buttondown Client

See `client.ts` for the Buttondown newsletter API client implementation.
