const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('https://exp.host/--/api/v2/push/send')) {
    return new Response(JSON.stringify({ data: [{ status: 'ok', id: 'test-ticket' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return nativeFetch(input, init);
};
