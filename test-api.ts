const API_URL = 'http://localhost:3000/api';

async function test() {
  console.log('💬 Sending stateless prompt to Pi Provider: "Say hello in one short sentence."');
  
  const response = await fetch(`${API_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Say hello in one short sentence.' })
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    throw new Error(`Failed to prompt: ${errorText}`);
  }

  const reader = response.body.getReader();
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
            console.log(`\n🛠️ Agent calling tool: ${event.toolName}`);
          }
        } catch (e) {
          // Ignore incomplete chunk errors
        }
      }
    }
  }

  console.log('\n\n✅ Stream completed successfully (Session automatically disposed).');
}

test().catch(console.error);
