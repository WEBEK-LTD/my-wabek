import Head from 'next/head'
import Link from 'next/link'

export default function Custom500() {
  return (
    <>
      <Head><title>500 – Server Error | WABEK</title></Head>
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-center px-4">
        <div className="w-20 h-20 bg-red-900/30 border border-red-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">⚠️</span>
        </div>
        <h1 className="font-display font-bold text-6xl text-slate-900 mb-2">500</h1>
        <p className="text-xl text-slate-400 mb-2">Server error</p>
        <p className="text-slate-500 text-sm mb-8 max-w-sm">
          Something went wrong on our end. Please try again in a moment.
        </p>
        <div className="flex gap-3">
          <button onClick={() => window.location.reload()} className="btn-primary">Try Again</button>
          <Link href="/dashboard" className="btn-secondary">Go to Dashboard</Link>
        </div>
      </div>
    </>
  )
}
