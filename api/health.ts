export default function handler(_req: Request): Response {
  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { 'content-type': 'application/json' },
  });
}
