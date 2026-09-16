import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { ConnectAccounts } from '@/components/auth/ConnectAccounts';
import { TimezoneSync } from '@/components/TimezoneSync';
import { Wordmark } from '@/components/TopBar';
import { UserMenu } from '@/components/UserMenu';
import { requirePageUser, toCoreUser } from '@/lib/auth/session';
import { getRepository } from '@/lib/data';

export const metadata: Metadata = { title: 'What may Morrow read?' };

/** Screen 14 — Connect accounts, onboarding step 2 of 3 (Paper 370-0 / 3DH-0). */
export default async function WelcomeSourcesPage({ searchParams }: PageProps<'/welcome/sources'>) {
  await connection();
  const user = await requirePageUser({ onboarding: true });
  if (user.onboardedAt) redirect('/sources');
  const { connect_error } = await searchParams;
  const sources = await getRepository().listSources(toCoreUser(user).id);

  return (
    <div className="flex min-h-dvh flex-col">
      <TimezoneSync timezone={user.timezone} />
      <header className="relative z-20 flex items-center justify-between px-6 py-5 lg:px-12 lg:py-7">
        <Wordmark />
        <div className="flex items-center gap-3.5">
          <span className="label hidden text-text-muted sm:inline">Signed in as {user.firstName}</span>
          <UserMenu name={user.name} image={user.image} email={user.email} />
        </div>
      </header>
      <ConnectAccounts initialSources={sources} connectError={typeof connect_error === 'string' ? connect_error : null} />
    </div>
  );
}
