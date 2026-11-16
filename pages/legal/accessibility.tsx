import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { LegalLayout } from '@/components/marketing/LegalLayout'
import { usePublicLang } from '@/components/marketing/usePublicLang'

// The statement itself is published in English only; the page chrome follows the visitor's language.
export default function AccessibilityPage() {
  const { brandName: wlName } = useWhiteLabel()
  const brandName = wlName || 'WABEK'
  const { lang, setLang, dir, t } = usePublicLang()

  return (
    <LegalLayout
      lang={lang}
      dir={dir}
      onLangChange={setLang}
      active="/legal/accessibility"
      headTitle={`Accessibility Statement — ${brandName}`}
      eyebrow={t('mk_legal_doc')}
      title={<span dir="ltr">Accessibility Statement</span>}
      updated={<span dir="ltr">Last updated: January 1, 2025</span>}
      docDir="ltr"
    >
      <section>
        <h2>Our Commitment</h2>
        <p>{brandName} is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply relevant accessibility standards.</p>
      </section>
      <section>
        <h2>Conformance Status</h2>
        <p>We aim to conform to the <strong>Web Content Accessibility Guidelines (WCAG) 2.1</strong> at Level AA. These guidelines define requirements for designers and developers to improve accessibility for people with disabilities.</p>
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
          <li><strong>Email:</strong> accessibility@waabek.com</li>
          <li><strong>Response time:</strong> We aim to respond within 3 business days</li>
        </ul>
        <p>We take accessibility feedback seriously and will work to resolve any issues reported.</p>
      </section>
      <section>
        <h2>Formal Complaints</h2>
        <p>If you are not satisfied with our response, you may contact the relevant national accessibility authority or equality body in your country.</p>
      </section>
    </LegalLayout>
  )
}
