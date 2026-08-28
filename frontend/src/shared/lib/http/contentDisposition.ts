/** Извлекает имя файла из заголовка Content-Disposition. */
export function parseContentDispositionFilename(contentDisposition: string): string | null {
  const utf8NameMatch = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  const basicNameMatch = contentDisposition.match(/filename\s*=\s*"?([^"]+)"?/i);
  const rawName = utf8NameMatch?.[1] ?? basicNameMatch?.[1];
  if (!rawName) {
    return null;
  }
  try {
    return decodeURIComponent(rawName.trim());
  } catch {
    return rawName.replace(/['"]/g, '').trim();
  }
}

function readHeader(
  headers: { get?: (name: string) => unknown } | Record<string, unknown>,
  name: string
): unknown {
  if (typeof (headers as { get?: unknown }).get === 'function') {
    const getter = (headers as { get: (n: string) => unknown }).get;
    return getter.call(headers, name);
  }
  return (headers as Record<string, unknown>)[name];
}

/** Читает Content-Disposition из заголовков axios и возвращает имя файла. */
export function filenameFromAxiosHeaders(
  headers: { get?: (name: string) => unknown } | Record<string, unknown>,
  fallback: string
): string {
  const raw =
    readHeader(headers, 'content-disposition') ?? readHeader(headers, 'Content-Disposition');
  const contentDisposition = typeof raw === 'string' ? raw : '';
  return parseContentDispositionFilename(contentDisposition) ?? fallback;
}
