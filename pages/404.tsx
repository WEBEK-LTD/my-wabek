import Head from 'next/head'
import Link from 'next/link'

export default function Custom404() {
  return (
    <>
      <Head>
      <link rel="icon" href="/brand/favicon-32.png" /><title>404 | Page Not Found</title></Head>
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-center px-4">
        <div className="w-20 h-20 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">🔍</span>
        </div>
        <h1 className="font-display font-bold text-6xl text-slate-900 mb-2">404</h1>
        <p className="text-xl text-slate-400 mb-2">Page not found</p>
        <p className="text-slate-500 text-sm mb-8 max-w-sm">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex gap-3">
          <Link href="/dashboard" className="btn-primary">Go to Dashboard</Link>
          <Link href="/" className="btn-secondary">Go Home</Link>
        </div>
      </div>
    </>
  )
}
