import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col px-6 pt-24 lg:px-[120px]">
      <h1 className="font-serif text-title-m lg:text-title">Morrow can&apos;t see that.</h1>
      <Link href="/" className="label pt-8 text-accent">
        Today&apos;s reading →
      </Link>
    </main>
  );
}
