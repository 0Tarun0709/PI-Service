const API_URL = 'http://localhost:3000/api';

async function test() {
  console.log('🔄 Creating a session via OpenRouter...');
  
  // 1. Create a session
  const createResponse = await fetch(`${API_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelProvider: 'openrouter',
      modelId: 'poolside/laguna-xs-2.1:free', // You can change this to any OpenRouter model
      workspacePath: './test-workspace',
      systemPrompt: 'You are a helpful assistant. Keep answers short and concise.',
      tools: ['read', 'ls'] // Limit tools for safety during testing
    })
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Failed to create session: ${errorText}`);
  }

  const { sessionId, model, workspacePath } = await createResponse.json() as any;
  console.log(`✅ Session created! ID: ${sessionId}`);
  console.log(`🤖 Model: ${model}`);
  console.log(`📂 Workspace: ${workspacePath}\n`);

  // 2. Prompt the session and stream response (SSE)
  console.log('💬 Sending prompt: "Say hello in one short sentence."');
  const promptResponse = await fetch(`${API_URL}/sessions/${sessionId}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Say hello in one short sentence.' })
  });

  if (!promptResponse.ok || !promptResponse.body) {
    throw new Error('Failed to start streaming response');
  }

  const reader = promptResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const rawData = line.substring(6);
        try {
          const event = JSON.parse(rawData);
          
          // Print text increments from the assistant
          if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
            process.stdout.write(event.assistantMessageEvent.delta);
          }
          
          // Print when a tool is called
          if (event.type === 'tool_call') {
            console.log(`\n🛠️ Calling tool: ${event.toolName}`);
          }
        } catch (e) {
          // Ignore parse errors from malformed/incomplete JSON chunks
        }
      }
    }
  }

  console.log('\n\n✅ Done streaming.');

  // 3. Clean up the session
  console.log('\n🧹 Disposing session...');
  const deleteResponse = await fetch(`${API_URL}/sessions/${sessionId}`, {
    method: 'DELETE'
  });
  
  if (deleteResponse.ok) {
    console.log('✅ Session disposed successfully.');
  } else {
    console.log('⚠️ Failed to dispose session.');
  }
}

test().catch(console.error);
