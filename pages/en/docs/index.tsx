import type { GetStaticProps } from 'next'
import DocsHome from '@/components/docs/DocsHome'
import { getDocsHomeProps } from '@/components/docs/lib/content.server'
import type { DocsHomeProps } from '@/components/docs/lib/types'

export default function EnglishDocsIndexPage(props: DocsHomeProps) {
  return <DocsHome {...props} />
}

export const getStaticProps: GetStaticProps<DocsHomeProps> = async () => ({
  props: getDocsHomeProps('en'),
})
