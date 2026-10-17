import { createApi } from '@/server/api';
import { getServices } from '@/server/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let api: ReturnType<typeof createApi>;

async function handle(request: Request) {
  try {
    api ??= createApi(getServices());
    return await api(request);
  } catch {
    console.error('API configuration is unavailable. Check server environment variables.');
    return Response.json(
      { statusCode: 503, message: 'The API is unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
export { handle as GET, handle as POST, handle as DELETE, handle as OPTIONS };
