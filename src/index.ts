/**
 * SSE data structure
 */
interface SSEData {
  type?: string;
  content?: string;
  [key: string]: unknown;
}

/**
 * Send POST request and get response
 * @param url - The request URL
 * @param postData - POST request data
 * @returns Response object with valid body
 */
const sendRequest = async (
  url: string,
  postData: Record<string, unknown>,
): Promise<Response> => {
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

  return response;
};

/**
 * Parse SSE data line and extract JSON data
 * @param line - SSE line string
 * @returns Parsed JSON data or null if invalid
 */
const parseSSEDataLine = (line: string): SSEData | null => {
  const trimmedLine = line.trim();

  // Skip empty lines and comment lines
  if (!trimmedLine || trimmedLine.startsWith(':')) {
    return null;
  }

  // Only process data lines
  if (!trimmedLine.startsWith('data: ')) {
    return null;
  }

  const data = trimmedLine.slice(6);

  try {
    return JSON.parse(data) as SSEData;
  } catch {
    // Ignore parsing errors
    return null;
  }
};

/**
 * Check if the SSE data is an answer type with content
 * @param data - SSE data object
 * @returns True if it's an answer type with content
 */
const isAnswerType = (data: SSEData | null): data is SSEData & { content: string } => {
  return data !== null && data.type === 'answer' && typeof data.content === 'string';
};

/**
 * Process SSE stream and find answer type data
 * @param reader - ReadableStreamDefaultReader
 * @param decoder - TextDecoder instance
 * @returns Answer content or null if not found
 */
const processSSEStream = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: InstanceType<typeof TextDecoder>,
): Promise<string | null> => {
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
      const data = parseSSEDataLine(line);

      if (isAnswerType(data)) {
        reader.cancel(); // Close connection immediately after finding the answer
        return data.content;
      }
    }
  }

  return null;
};

/**
 * Extract content from answer type in SSE stream
 * Establish a long connection and return response immediately when type=answer is encountered
 * @param url - The request URL
 * @param postData - POST request data
 * @returns Returns the content field of answer type data
 */
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
  const response = await sendRequest(url, postData);

  if (!response.body) {
    throw new Error('Response body is empty');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  const answer = await processSSEStream(reader, decoder);

  if (answer === null) {
    throw new Error('Answer type response not found');
  }

  return answer;
};
