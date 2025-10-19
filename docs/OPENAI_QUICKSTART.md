# OpenAI API Quick Start

## ✅ What's Been Set Up

1. ✅ OpenAI SDK installed (`openai` package)
2. ✅ OpenAI client created at `lib/api/openai-client.ts`
3. ✅ Example scripts at `scripts/example-openai-usage.ts`
4. ✅ Documentation at `docs/OPENAI_SETUP.md`
5. ✅ NPM script added: `npm run openai:examples`

## 🔑 Next Steps

### 1. Add Your API Key

Add this line to your `.env` file:

```bash
OPENAI_API_KEY=sk-your-api-key-here
```

Get your key from: https://platform.openai.com/api-keys

### 2. Test the Setup

Run the example script:

```bash
npm run openai:examples
```

Or create a simple test:

```typescript
import 'dotenv/config';
import { OpenAIClient } from './lib/api/openai-client.js';

const client = new OpenAIClient(process.env.OPENAI_API_KEY!);

const response = await client.createChatCompletion({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Say hello!' }],
});

console.log(client.extractContent(response));
```

## 📝 Common Usage Patterns

### Simple Completion

```typescript
const response = await client.createChatCompletion({
  model: 'gpt-5-mini',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Your question here' },
  ],
});

const answer = client.extractContent(response);
```

### Bulk Processing

```typescript
const items = ['item1', 'item2', 'item3'];

const result = await client.processBatch(
  items,
  async (item) => {
    const response = await client.createChatCompletion({
      model: 'gpt-5-mini',
      messages: [{ role: 'user', content: `Process: ${item}` }],
    });
    return client.extractContent(response);
  },
  {
    concurrency: 5, // Process 5 at a time
    onProgress: (done, total) => console.log(`${done}/${total}`),
  }
);

console.log(`Successful: ${result.successful.length}`);
console.log(`Failed: ${result.failed.length}`);
```

### With Your Newsletter Data

```typescript
import { db } from './lib/db/schema.js';

// Get emails from your database
const stmt = db.prepare('SELECT id, subject, body FROM emails LIMIT 10');
const emails = stmt.all();

// Process them
const result = await client.processBatch(
  emails,
  async (email: any) => {
    const response = await client.createChatCompletion({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'user',
          content: `Summarize this email: ${email.subject}`,
        },
      ],
      max_tokens: 100,
    });
    return {
      id: email.id,
      summary: client.extractContent(response),
    };
  },
  {
    concurrency: 5,
    delayMs: 200,
  }
);
```

## 💰 Cost Reference

Using `gpt-4o-mini` (recommended for bulk):

- **Input**: $0.15 per 1M tokens
- **Output**: $0.60 per 1M tokens

Example: Processing 1,000 short emails (~500 input + 100 output tokens each):

- Input: 500k tokens × $0.15/1M = **$0.075**
- Output: 100k tokens × $0.60/1M = **$0.060**
- **Total: ~$0.14**

## 📚 Documentation

- **Full setup guide**: `docs/OPENAI_SETUP.md`
- **API reference**: `lib/api/README.md`
- **Example code**: `scripts/example-openai-usage.ts`

## 🛠️ Available Methods

```typescript
// Chat completion
await client.createChatCompletion(params);

// Streaming
await client.createChatCompletionStream(params);

// Batch processing
await client.processBatch(items, processor, options);

// Sequential processing
await client.processSequential(items, processor, options);

// Extract content from response
client.extractContent(completion);

// Access raw OpenAI client
client.getRawClient();
```

## 🚀 Ready to Use!

Once you add your API key to `.env`, you're ready to start bulk processing tasks!
