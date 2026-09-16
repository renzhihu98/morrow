import { routeForDeepLink } from './deep-link';

describe('routeForDeepLink', () => {
  it('maps the OAuth onboarding return to the sources route without the cookie', () => {
    expect(routeForDeepLink('morrow:///welcome/sources?cookie=better-auth.session_token%3Dabc')).toBe('/sources');
    expect(routeForDeepLink('exp://192.168.1.20:8081/--/welcome/sources?cookie=x')).toBe('/sources');
  });
  it('never forwards a cookie param', () => {
    expect(routeForDeepLink('morrow:///?cookie=x')).toBe('/');
  });
  it('leaves other links alone', () => {
    expect(routeForDeepLink('/readings/2026-09-16')).toBe('/readings/2026-09-16');
  });
});
