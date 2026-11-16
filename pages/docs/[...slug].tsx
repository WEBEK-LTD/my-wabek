import type { GetStaticPaths, GetStaticProps } from 'next'
import DocPage from '@/components/docs/DocPage'
import { getDocPageProps, getDocsStaticPaths } from '@/components/docs/lib/content.server'
import type { DocPageProps } from '@/components/docs/lib/types'

export default function DocsArticlePage(props: DocPageProps) {
  return <DocPage {...props} />
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: getDocsStaticPaths(),
  fallback: false,
})

export const getStaticProps: GetStaticProps<DocPageProps, { slug: string[] }> = async ({ params }) => {
  const props = getDocPageProps('ar', (params?.slug || []).join('/'))
  return props ? { props } : { notFound: true }
}
