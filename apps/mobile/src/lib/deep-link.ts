/**
 * Router path for an incoming deep link. OAuth returns (`morrow:///welcome/sources?cookie=…`, or
 * `exp://…/--/welcome/sources?cookie=…` in Expo Go) are normally captured by the auth session, but on
 * Android they can also reach the router: never route with the session cookie in the URL, and map the
 * web onboarding path onto the mobile route.
 */
export function routeForDeepLink(path: string): string {
  const [route = '', query = ''] = path.split('?');
  const onboarding = route.includes('/welcome/sources');
  if (/(^|&)cookie=/.test(query)) return onboarding ? '/sources' : '/';
  return onboarding ? '/sources' : path;
}
