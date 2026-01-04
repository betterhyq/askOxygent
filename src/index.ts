/**
 * Extract content from answer type in SSE stream
 * Establish a long connection and return response immediately when type=answer is encountered
 * @param url - The request URL
 * @param postData - POST request data
 * @returns Returns the content field of answer type data
 */
export const fetchSSEAnswer = async (
  url: string,
  postData: Record<string, unknown>,
): Promise<string> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(postData),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Response body is empty');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith(':')) {
        continue;
      }

      if (trimmedLine.startsWith('data: ')) {
        const data = trimmedLine.slice(6);

        try {
          const jsonData = JSON.parse(data);
          if (jsonData.type === 'answer' && jsonData.content) {
            reader.cancel(); // Close connection immediately after finding the answer
            return jsonData.content;
          }
        } catch {
          // Ignore parsing errors
        }
      }
    }
  }

  throw new Error('Answer type response not found');
};
