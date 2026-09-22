import { Wordmark } from '@/components/TopBar';
import { ArrowRight, ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center border-b border-hairline px-6 lg:h-[88px] lg:px-12">
        <Wordmark />
      </header>
      <main className="mx-auto flex w-full max-w-[1088px] flex-col items-start px-6 pt-16 lg:box-content lg:px-12 lg:pt-[120px]">
        <h1 className="font-serif text-title-m text-text lg:text-title">Morrow can&apos;t see that.</h1>
        <p className="max-w-[360px] pt-5 text-body-m text-text-muted lg:text-body">
          The page you asked for isn&apos;t here, or it has already been forgotten.
        </p>
        <ButtonLink href="/" variant="link" className="mt-8">
          Today&apos;s reading <ArrowRight />
        </ButtonLink>
      </main>
    </div>
  );
}
