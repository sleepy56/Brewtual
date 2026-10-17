import { AuthController } from './auth.controller';

describe('Browser authentication boundary', () => {
  const environment = { ...process.env };
  let auth: any;
  let controller: AuthController;
  let response: any;
  const session = { accessToken: 'access', refreshToken: 'secret', user: { id: 'id', email: 'alex@example.com' } };
  const request = (origin?: string, cookie?: string) => ({ get: () => origin, headers: { cookie } }) as any;
  beforeEach(() => {
    process.env.CORS_ORIGINS = 'https://habits.example.com'; process.env.NODE_ENV = 'production';
    auth = { login: jest.fn().mockResolvedValue(session), refresh: jest.fn().mockResolvedValue(session), logout: jest.fn() };
    controller = new AuthController(auth);
    response = { setHeader: jest.fn(), cookie: jest.fn(), clearCookie: jest.fn() };
  });
  afterAll(() => { process.env = environment; });

  it('keeps browser refresh credentials in secure HttpOnly cookies', async () => {
    const result = await controller.login(request('https://habits.example.com'), response, { email: 'alex@example.com', password: 'password', client: 'web' });
    expect(result).not.toHaveProperty('refreshToken');
    expect(response.cookie).toHaveBeenCalledWith('pair_refresh', 'secret', expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'strict', path: '/api/v1/auth' }));
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it.each([['https://evil.example', 'web'], [undefined, 'web'], ['https://evil.example', 'native']])('rejects untrusted browser origins', async (origin, client) => {
    await expect(controller.login(request(origin), response, { email: 'alex@example.com', password: 'password', client: client as 'web' | 'native' })).rejects.toThrow('Untrusted');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('permits native clients without an Origin header', async () => {
    const result = await controller.login(request(), response, { email: 'alex@example.com', password: 'password', client: 'native' });
    expect(result).toHaveProperty('refreshToken', 'secret');
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('uses the cookie, not a body token, for browser refresh', async () => {
    await controller.refresh(request('https://habits.example.com', 'other=1; pair_refresh=cookie-secret'), response, { client: 'web', refreshToken: 'ignored' });
    expect(auth.refresh).toHaveBeenCalledWith('cookie-secret');
    await expect(controller.refresh(request(undefined, 'pair_refresh=secret'), response, { client: 'native' })).rejects.toThrow('Untrusted');
  });
});
