export function extractResponseText(payload: unknown): string {
  if (isRecord(payload) && typeof payload.output_text === 'string') {
    return payload.output_text;
  }

  const chunks: string[] = [];
  if (isRecord(payload) && Array.isArray(payload.output)) {
    for (const output of payload.output) {
      if (!isRecord(output)) {
        continue;
      }

      if (typeof output.text === 'string') {
        chunks.push(output.text);
      }

      if (Array.isArray(output.content)) {
        for (const content of output.content) {
          if (isRecord(content) && typeof content.text === 'string') {
            chunks.push(content.text);
          }
        }
      }
    }
  }

  if (chunks.length === 0) {
    throw new Error('Provider response did not include text output.');
  }

  return chunks.join('\n');
}

export function extractImagesApiDataUrl(payload: unknown): string {
  if (isRecord(payload) && Array.isArray(payload.data)) {
    for (const item of payload.data) {
      if (isRecord(item) && typeof item.b64_json === 'string' && item.b64_json.length > 0) {
        return `data:image/png;base64,${item.b64_json}`;
      }

      if (isRecord(item) && typeof item.url === 'string' && item.url.length > 0) {
        return item.url;
      }
    }
  }

  throw new Error('Provider response did not include edited image data.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
