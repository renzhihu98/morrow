import { routeForDeepLink } from '@/lib/deep-link';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return routeForDeepLink(path);
}
