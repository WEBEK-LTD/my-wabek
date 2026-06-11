import Head from 'next/head'
import Link from 'next/link'

export default function Custom404() {
  return (
    <>
      <Head>
      <link rel="icon" href="https://res.cloudinary.com/dkl7ntpgw/image/upload/f_auto,q_auto/%D8%AA%D8%B5%D9%85%D9%8A%D9%85_%D8%A8%D8%AF%D9%88%D9%86_%D8%B9%D9%86%D9%88%D8%A7%D9%86_1_kejdrs" /><title>404 | Page Not Found</title></Head>
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
