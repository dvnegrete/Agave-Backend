export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function hasHeaderKeywords(
  line: string | any[],
  keywords: string[],
): boolean {
  if (Array.isArray(line)) {
    const lowerLine = line.map((cell) => cell?.toString().toLowerCase() || '');
    return keywords.some((keyword) =>
      lowerLine.some((cell) => cell.includes(keyword)),
    );
  }
  if (typeof line === 'string') {
    const lowerLine = line.toLowerCase();
    return keywords.some((keyword) => lowerLine.includes(keyword));
  }
  return false;
}

export function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

export function bufferToString(
  buffer: Buffer,
  encoding: BufferEncoding = 'utf-8',
): string {
  return buffer.toString(encoding);
}
