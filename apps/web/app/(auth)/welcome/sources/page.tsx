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

/** 02 Connect accounts, onboarding step 2 of 3 (Paper v4 BW0-0 / CAQ-0). */
export default async function WelcomeSourcesPage({ searchParams }: PageProps<'/welcome/sources'>) {
  await connection();
  const user = await requirePageUser({ onboarding: true });
  if (user.onboardedAt) redirect('/sources');
  const { connect_error } = await searchParams;
  const sources = await getRepository().listSources(toCoreUser(user).id);

  return (
    <div className="flex min-h-dvh flex-col">
      <TimezoneSync timezone={user.timezone} />
      <header className="relative z-20 mx-auto flex h-16 w-full max-w-[1088px] items-center justify-between px-6 lg:box-content lg:h-24 lg:px-12">
        <Wordmark size="sm" />
        <UserMenu name={user.name} image={user.image} email={user.email} showName />
      </header>
      <ConnectAccounts initialSources={sources} connectError={typeof connect_error === 'string' ? connect_error : null} />
    </div>
  );
}
