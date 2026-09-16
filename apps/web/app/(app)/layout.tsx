import { TimezoneSync } from '@/components/TimezoneSync';
import { TopBar } from '@/components/TopBar';
import { requirePageUser } from '@/lib/auth/session';

/** App screens (Today, Readings, Prophecies, Sources): signed in + onboarded (SPEC §12.2). */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requirePageUser();
  return (
    <>
      <TopBar user={user} />
      <TimezoneSync timezone={user.timezone} />
      {children}
    </>
  );
}
