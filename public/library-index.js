// Static SPA servers may return index.html for an absent optional local index.
// Only absence or an HTML fallback selects the committed gallery. A broken
// local JSON index remains an error so saved studies are not silently hidden.
export async function loadLibraryIndex(fetcher = globalThis.fetch) {
  const local = await fetcher('/library/index.local.json');
  const htmlFallback = local.ok && /^text\/html(?:\s*;|$)/i.test(local.headers.get('content-type') || '');
  const response = local.status === 404 || htmlFallback
    ? await fetcher('/library/index.json')
    : local;
  if (!response.ok) throw new Error('Image library could not be loaded.');
  const list = await response.json();
  if (!Array.isArray(list)) throw new Error('Image library index must be a list.');
  return list;
}
