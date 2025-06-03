function handleSocketConnection(ws : any, userId:string) {
  ws.userId = userId;

  console.log(`User connected: ${userId}`);

  ws.on('message', async (data:any) => {
    try {
      const { prompt } = JSON.parse(data.toString());
      const reply = await callOpenRouter(prompt);
      ws.send(JSON.stringify({ reply }));
    } catch (err) {
      console.error('Message handling error:', err);
      ws.send(JSON.stringify({ error: 'Failed to handle message' }));
    }
  });
}

async function callOpenRouter(prompt: string): Promise<string> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'EmailManager'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat-v3-0324:free',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (res.status === 429) {
      // Too Many Requests
      return 'OpenRouter API rate limit reached. Please try again later.';
    }

    if (!res.ok) {
      throw new Error(`OpenRouter API error: ${res.statusText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('OpenRouter API call failed:', error);
    return 'Failed to generate reply due to API error.';
  }
}

export default handleSocketConnection;