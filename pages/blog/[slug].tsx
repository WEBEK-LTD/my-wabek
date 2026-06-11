// @ts-nocheck
import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import PublicNav from '@/components/PublicNav'
import PublicFooter from '@/components/PublicFooter'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { t, getStoredLang } from '@/lib/i18n'
import { posts } from '@/lib/blog-posts'
import { getPostContent } from '@/lib/blog-translations'

const POST_KEYS = [
  { tk: 'post1_title', ek: 'post1_excerpt', cat: 'blog_cat_guides' },
  { tk: 'post2_title', ek: 'post2_excerpt', cat: 'blog_cat_automation' },
  { tk: 'post3_title', ek: 'post3_excerpt', cat: 'blog_cat_ai' },
  { tk: 'post4_title', ek: 'post4_excerpt', cat: 'blog_cat_marketing' },
  { tk: 'post5_title', ek: 'post5_excerpt', cat: 'blog_cat_guides' },
  { tk: 'post6_title', ek: 'post6_excerpt', cat: 'blog_cat_reseller' },
  { tk: 'post7_title', ek: 'post7_excerpt', cat: 'blog_cat_integrations' },
]

const CAT_COLORS: Record<string,string> = {
  blog_cat_guides: '#25D366', blog_cat_automation: '#0EA5E9',
  blog_cat_ai: '#8B5CF6', blog_cat_marketing: '#F59E0B',
  blog_cat_reseller: '#6366F1', blog_cat_integrations: '#EF4444',
}

export default function BlogPost() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const router = useRouter()
  const { slug } = router.query
  const [lang, setLang] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('lang') || 'en' : 'en')
  useEffect(() => {
    setLang(getStoredLang())
    const h = (e: any) => setLang(e.detail)
    window.addEventListener('langchange', h)
    return () => window.removeEventListener('langchange', h)
  }, [])
  const isRTL = lang === 'ar'
  const dir = isRTL ? 'rtl' : 'ltr'

  const postIndex = posts.findIndex(p => p.slug === slug)
  const post = posts[postIndex]
  const keys = POST_KEYS[postIndex] || { tk: '', ek: '', cat: 'blog_cat_guides' }
  const related = posts.filter((_,i) => i !== postIndex).slice(0, 3).map((p, i) => {
    const relIdx = posts.findIndex(x => x.slug === p.slug)
    return { post: p, keys: POST_KEYS[relIdx] || POST_KEYS[0] }
  })

  if (!post) return (
    <>
      <PublicNav active="/blog" onLangChange={setLang} />
      <div style={{maxWidth:600,margin:'120px auto',textAlign:'center',padding:'0 20px'}}>
        <div style={{fontSize:64,marginBottom:20}}>📄</div>
        <h1 style={{fontSize:28,fontWeight:800,marginBottom:12}}>Article not found</h1>
        <Link href="/blog" style={{color:'#25D366',fontWeight:700}}>{t(lang,'blog_back')}</Link>
      </div>
      <PublicFooter lang={lang} />
    </>
  )

  const displayTitle = t(lang, keys.tk) || post.title
  const displayExcerpt = t(lang, keys.ek) || post.excerpt
  const displayCat = t(lang, keys.cat)
  const translatedContent = getPostContent(post.slug, lang)

  return (
    <>
      <Head>
        <link rel="icon" href="https://res.cloudinary.com/dkl7ntpgw/image/upload/f_auto,q_auto/%D8%AA%D8%B5%D9%85%D9%8A%D9%85_%D8%A8%D8%AF%D9%88%D9%86_%D8%B9%D9%86%D9%88%D8%A7%D9%86_1_kejdrs" />
        <title>{displayTitle} | {name}</title>
        <meta name="description" content={displayExcerpt} />
        <meta property="og:title" content={displayTitle} />
        <meta property="og:description" content={displayExcerpt} />
      </Head>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#111b21}
        a{text-decoration:none;color:inherit}
        .prose{font-size:16px;line-height:1.85;color:#374151}
        .prose h2{font-size:24px;font-weight:800;color:#111b21;margin:40px 0 16px;line-height:1.2}
        .prose h3{font-size:19px;font-weight:700;color:#111b21;margin:28px 0 12px}
        .prose p{margin-bottom:18px}
        .prose ul,.prose ol{padding-inline-start:24px;margin-bottom:18px}
        .prose li{margin-bottom:8px}
        .prose strong{font-weight:700;color:#111b21}
        .prose a{color:#25D366;font-weight:600}
        .prose a:hover{text-decoration:underline}
        .prose blockquote{border-inline-start:4px solid #25D366;padding:12px 20px;background:#f0fdf4;border-radius:0 8px 8px 0;margin:24px 0;font-style:italic}
        .tag{display:inline-block;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;color:#fff}
        .rcard{background:#fff;border:1px solid #e9edef;border-radius:12px;overflow:hidden;transition:all .2s;display:flex;flex-direction:column}
        .rcard:hover{border-color:#25D366;box-shadow:0 4px 16px rgba(37,211,102,.1)}
        .rgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
        @media(max-width:700px){.rgrid{grid-template-columns:1fr}}
      `}</style>

      <PublicNav active="/blog" onLangChange={setLang} />

      <article style={{maxWidth:740,margin:'0 auto',padding:'48px 20px 80px',direction:dir}}>

        <Link href="/blog" style={{display:'inline-flex',alignItems:'center',gap:6,color:'#54656f',fontSize:14,marginBottom:32,fontWeight:500,textDecoration:'none'}}>
          {t(lang,'blog_back')}
        </Link>

        <div style={{marginBottom:32}}>
          <span className="tag" style={{background: CAT_COLORS[keys.cat]||'#25D366',marginBottom:14}}>{displayCat}</span>
          <h1 style={{fontSize:'clamp(24px,5vw,38px)',fontWeight:900,lineHeight:1.15,marginBottom:18,color:'#111b21'}}>{displayTitle}</h1>
          <div style={{display:'flex',alignItems:'center',gap:14,fontSize:13,color:'#8696a0',marginBottom:24}}>
            <span>{post.date}</span><span>·</span>
            <span>{post.readTime} {t(lang,'blog_min_read')}</span>
          </div>
          <div style={{borderRadius:16,overflow:'hidden',marginBottom:28,maxHeight:420,background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            {post.image
              ? <img src={post.image} alt={displayTitle}
                  style={{width:'100%',height:'100%',objectFit:'cover',display:'block',minHeight:320,maxHeight:420}} />
              : <span style={{fontSize:72,padding:'40px 0'}}>{post.emoji}</span>
            }
          </div>
          <p style={{fontSize:17,color:'#54656f',lineHeight:1.7,fontStyle:'italic',borderInlineStart:'4px solid #25D366',paddingInlineStart:16}}>{displayExcerpt}</p>
        </div>

        <div className="prose" dangerouslySetInnerHTML={{ __html: translatedContent || post.content }} />

        <div style={{background:'linear-gradient(135deg,#25D366,#1da851)',borderRadius:16,padding:'32px',textAlign:'center',marginTop:48}}>
          <h3 style={{fontSize:22,fontWeight:800,color:'#0F172A',marginBottom:10}}>{t(lang,'about_cta_title')}</h3>
          <p style={{fontSize:15,color:'rgba(255,255,255,.85)',marginBottom:24}}>{name} — {t(lang,'hero_note')}</p>
          <Link href="/auth/register" style={{background:'#fff',color:'#25D366',padding:'12px 32px',borderRadius:9,fontSize:15,fontWeight:700,display:'inline-block'}}>{t(lang,'get_started')} →</Link>
        </div>
      </article>

      {related.length > 0 && (
        <section style={{background:'#f9fafb',padding:'48px 20px 64px',direction:dir}}>
          <div style={{maxWidth:1000,margin:'0 auto'}}>
            <h2 style={{fontSize:20,fontWeight:800,marginBottom:24}}>{t(lang,'blog_all')}</h2>
            <div className="rgrid">
              {related.map(({ post: p, keys: k }) => (
                <Link key={p.slug} href={`/blog/${p.slug}`}>
                  <div className="rcard">
                    <div style={{height:120,background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {p.image
                        ? <img src={p.image} alt={t(lang,k.tk)||p.title}
                            style={{width:'100%',height:'100%',objectFit:'cover',transition:'transform .3s'}}
                            onMouseOver={e=>(e.currentTarget.style.transform='scale(1.06)')}
                            onMouseOut={e=>(e.currentTarget.style.transform='scale(1)')} />
                        : <span style={{fontSize:40}}>{p.emoji}</span>
                      }
                    </div>
                    <div style={{padding:14,flex:1}}>
                      <span className="tag" style={{background: CAT_COLORS[k.cat]||'#25D366',marginBottom:8}}>{t(lang,k.cat)}</span>
                      <h3 style={{fontSize:13,fontWeight:700,lineHeight:1.4,marginBottom:8,color:'#111b21'}}>{t(lang,k.tk) || p.title}</h3>
                      <div style={{fontSize:11,color:'#8696a0',display:'flex',justifyContent:'space-between'}}>
                        <span>{p.date}</span><span>{p.readTime} {t(lang,'blog_min_read')}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <PublicFooter lang={lang} />
    </>
  )
}
