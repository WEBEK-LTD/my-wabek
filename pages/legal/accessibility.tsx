// @ts-nocheck
import Head from 'next/head'
import Link from 'next/link'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'

export default function AccessibilityPage() {
  const { brandName } = useWhiteLabel()
  return (
    <>
      <Head><title>Accessibility Statement — {brandName}</title></Head>
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
        <nav className="border-b border-slate-200/50 sticky top-0 bg-[#F8FAFC]/90 backdrop-blur z-50">
          <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-4">
            <Link href="/" className="font-display font-bold text-slate-900">{brandName}</Link>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400 text-sm">Accessibility</span>
          </div>
        </nav>
        <div className="max-w-3xl mx-auto px-6 py-12">
          <h1 className="font-display text-4xl font-bold mb-2">Accessibility Statement</h1>
          <p className="text-slate-400 mb-10">Last updated: January 1, 2025</p>
          <div className="prose-custom space-y-8">
            <section>
              <h2>Our Commitment</h2>
              <p>{brandName} is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply relevant accessibility standards.</p>
            </section>
            <section>
              <h2>Conformance Status</h2>
              <p>We aim to conform to the <strong className="text-slate-900">Web Content Accessibility Guidelines (WCAG) 2.1</strong> at Level AA. These guidelines define requirements for designers and developers to improve accessibility for people with disabilities.</p>
              <p>Our current implementation includes:</p>
              <ul>
                <li>Sufficient color contrast ratios throughout the interface</li>
                <li>Keyboard navigation support for all interactive elements</li>
                <li>Descriptive labels for form inputs and buttons</li>
                <li>Responsive design supporting zoom up to 400%</li>
                <li>Screen reader compatible markup (ARIA labels where applicable)</li>
                <li>Focus indicators on interactive elements</li>
                <li>Consistent navigation across pages</li>
              </ul>
            </section>
            <section>
              <h2>Known Limitations</h2>
              <p>We are aware of the following areas currently being improved:</p>
              <ul>
                <li>The visual chatbot flow builder (drag-and-drop canvas) may have limited keyboard accessibility — a text-based alternative is in development</li>
                <li>Some data visualizations (charts) may not have full screen reader support — tabular data alternatives are planned</li>
                <li>Rich text campaign editor accessibility is being enhanced</li>
              </ul>
            </section>
            <section>
              <h2>Technical Specifications</h2>
              <p>Accessibility relies on the following technologies:</p>
              <ul>
                <li>HTML5 semantic markup</li>
                <li>CSS (with high contrast support)</li>
                <li>JavaScript (progressive enhancement where possible)</li>
                <li>WAI-ARIA roles and properties</li>
              </ul>
            </section>
            <section>
              <h2>Assistive Technology Compatibility</h2>
              <p>The platform is designed to be compatible with:</p>
              <ul>
                <li>Screen readers (NVDA, JAWS, VoiceOver)</li>
                <li>Browser zoom and text scaling</li>
                <li>Keyboard-only navigation</li>
                <li>High contrast browser modes</li>
                <li>Speech recognition software</li>
              </ul>
            </section>
            <section>
              <h2>Feedback & Contact</h2>
              <p>We welcome feedback on the accessibility of {brandName}. If you encounter barriers or have suggestions for improvement, please contact us:</p>
              <ul>
                <li><strong className="text-slate-900">Email:</strong> accessibility@waabek.com</li>
                <li><strong className="text-slate-900">Response time:</strong> We aim to respond within 3 business days</li>
              </ul>
              <p>We take accessibility feedback seriously and will work to resolve any issues reported.</p>
            </section>
            <section>
              <h2>Formal Complaints</h2>
              <p>If you are not satisfied with our response, you may contact the relevant national accessibility authority or equality body in your country.</p>
            </section>
          </div>
          <div className="mt-12 pt-8 border-t border-slate-200 flex flex-wrap gap-4 text-sm text-slate-500">
            <Link href="/legal/terms" className="hover:text-slate-900">Terms of Service</Link>
            <Link href="/legal/privacy" className="hover:text-slate-900">Privacy Policy</Link>
            <Link href="/legal/refund" className="hover:text-slate-900">Refund Policy</Link>
            <Link href="/" className="hover:text-slate-900 ml-auto">← Back to {brandName}</Link>
          </div>
        </div>
      </div>
      <style jsx global>{`.prose-custom h2{font-family:var(--font-display,sans-serif);font-size:1.25rem;font-weight:700;color:white;margin-top:2rem;margin-bottom:.75rem}.prose-custom h3{font-size:1rem;font-weight:600;color:#e5e7eb;margin-top:1.25rem;margin-bottom:.5rem}.prose-custom p{color:#9ca3af;line-height:1.7;margin-bottom:.75rem}.prose-custom ul{color:#9ca3af;padding-left:1.5rem;margin-bottom:.75rem}.prose-custom li{margin-bottom:.35rem;line-height:1.6}.prose-custom ul li{list-style-type:disc}`}</style>
    </>
  )
}
