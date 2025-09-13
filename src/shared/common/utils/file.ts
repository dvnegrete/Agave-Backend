export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function hasHeaderKeywords(
  line: string | unknown[],
  keywords: string[],
): boolean {
  if (Array.isArray(line)) {
    const lowerLine = line.map((cell) => {
      if (cell === null || cell === undefined) return '';
      if (typeof cell === 'string') return cell.toLowerCase();
      if (typeof cell === 'number' || typeof cell === 'boolean')
        return String(cell).toLowerCase();
      return JSON.stringify(cell).toLowerCase();
    });
    return keywords.some((keyword) =>
      lowerLine.some((cell) => cell.includes(keyword.toLowerCase())),
    );
  }
  if (typeof line === 'string') {
    const lowerLine = line.toLowerCase();
    return keywords.some((keyword) =>
      lowerLine.includes(keyword.toLowerCase()),
    );
  }
  return false;
}

export function findHeaderRowIndex(
  data: (string | unknown[])[],
  keywords: string[],
  maxRowsToCheck = 10,
): number {
  for (let i = 0; i < Math.min(data.length, maxRowsToCheck); i++) {
    if (hasHeaderKeywords(data[i], keywords)) {
      return i;
    }
  }
  return -1; // No se encontró fila de encabezados
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
