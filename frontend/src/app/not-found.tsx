import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-24 text-center">
      <div className="text-6xl" aria-hidden>🎋</div>
      <h1 className="mt-6 font-display text-3xl font-bold text-leaf-900">
        Page not found
      </h1>
      <p className="mt-2 text-bamboo-800">
        That page isn&apos;t in the atlas. Try one of these instead:
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-lg bg-leaf-600 px-5 py-2.5 font-semibold text-white hover:bg-leaf-700">
          Home
        </Link>
        <Link href="/atlas" className="rounded-lg border border-bamboo-300 bg-bamboo-50 px-5 py-2.5 font-semibold text-bamboo-800 hover:bg-bamboo-100">
          Bamboo Atlas
        </Link>
      </div>
    </div>
  );
}
