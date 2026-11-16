// @ts-nocheck
import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import PublicNav from '@/components/PublicNav'
import PublicFooter from '@/components/PublicFooter'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { t, getStoredLang } from '@/lib/i18n'
import { posts } from '@/lib/blog-posts'

// Map slug index to translation keys
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

export default function BlogIndex() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const [lang, setLang] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('lang') || 'en' : 'en')
  useEffect(() => {
    setLang(getStoredLang())
    const h = (e: any) => setLang(e.detail)
    window.addEventListener('langchange', h)
    return () => window.removeEventListener('langchange', h)
  }, [])
  const isRTL = lang === 'ar'
  const dir = isRTL ? 'rtl' : 'ltr'

  const featured = posts[0]
  const featuredKeys = POST_KEYS[0]
  const rest = posts.slice(1).map((p, i) => ({ post: p, keys: POST_KEYS[i + 1] || { tk: '', ek: '', cat: 'blog_cat_guides' } }))

  return (
    <>
      <Head>
      <link rel="icon" href="/brand/favicon-32.png" />
        <title>{t(lang,'blog_title')} | {name}</title>
        <meta name="description" content={t(lang,'blog_subtitle')} />
      </Head>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#111b21}
        a{text-decoration:none;color:inherit}
        .card{background:#fff;border:1px solid #e9edef;border-radius:14px;overflow:hidden;transition:all .2s;display:flex;flex-direction:column;height:100%}
        .card:hover{border-color:#25D366;box-shadow:0 4px 20px rgba(37,211,102,.1);transform:translateY(-2px)}
        .tag{display:inline-block;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;color:#fff}
        .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
        @media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:580px){.grid{grid-template-columns:1fr}}
        @media(max-width:640px){.feat-inner{flex-direction:column!important}}
      `}</style>

      <PublicNav active="/blog" onLangChange={setLang} />

      {/* Hero */}
      <section style={{background:'linear-gradient(160deg,#f0fdf4,#fff)',padding:'72px 20px 48px',textAlign:'center',direction:dir}}>
        <div style={{maxWidth:640,margin:'0 auto'}}>
          <div style={{display:'inline-block',background:'#dcfce7',border:'1px solid #86efac',borderRadius:100,padding:'5px 16px',marginBottom:18,fontSize:13,color:'#166534',fontWeight:700}}>
            {name} {t(lang,'blog_title')}
          </div>
          <h1 style={{fontSize:'clamp(28px,5vw,48px)',fontWeight:800,marginBottom:14,lineHeight:1.1}}>
            WhatsApp Automation<br /><span style={{color:'#25D366'}}>Insights & Guides</span>
          </h1>
          <p style={{fontSize:16,color:'#54656f',lineHeight:1.7}}>{t(lang,'blog_subtitle')}</p>
        </div>
      </section>

      <div style={{maxWidth:1100,margin:'0 auto',padding:'48px 20px 80px',direction:dir}}>

        {/* Featured */}
        {featured && (
          <div style={{marginBottom:52}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
              <span style={{width:3,height:18,background:'#25D366',borderRadius:2,display:'inline-block'}}/>
              <span style={{fontSize:12,fontWeight:700,color:'#25D366',textTransform:'uppercase',letterSpacing:'0.5px'}}>{t(lang,'blog_featured')}</span>
            </div>
            <Link href={`/blog/${featured.slug}`}>
              <div className="feat-inner" style={{background:'#fff',border:'1px solid #e9edef',borderRadius:18,overflow:'hidden',display:'flex',transition:'all .2s'}}
                onMouseOver={e=>{(e.currentTarget as any).style.borderColor='#25D366';(e.currentTarget as any).style.boxShadow='0 4px 24px rgba(37,211,102,.12)'}}
                onMouseOut={e=>{(e.currentTarget as any).style.borderColor='#e9edef';(e.currentTarget as any).style.boxShadow='none'}}>
                <div style={{minWidth:260,height:220,background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:76,flexShrink:0}}>
                  {featured.image
                    ? <img src={featured.image} alt={featured.title} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                    : <span style={{fontSize:72}}>{featured.emoji}</span>
                  }
                </div>
                <div style={{padding:'24px 28px',display:'flex',flexDirection:'column',justifyContent:'center',flex:1}}>
                  <span className="tag" style={{background: CAT_COLORS[featuredKeys.cat]||'#25D366',marginBottom:14,alignSelf:'flex-start'}}>{t(lang,featuredKeys.cat)}</span>
                  <h2 style={{fontSize:'clamp(16px,2.5vw,22px)',fontWeight:800,marginBottom:10,lineHeight:1.3,color:'#111b21'}}>{t(lang,featuredKeys.tk) || featured.title}</h2>
                  <p style={{fontSize:14,color:'#54656f',lineHeight:1.7,marginBottom:16}}>{t(lang,featuredKeys.ek) || featured.excerpt}</p>
                  <div style={{display:'flex',alignItems:'center',gap:10,fontSize:12,color:'#8696a0'}}>
                    <span>{featured.date}</span><span>·</span>
                    <span>{featured.readTime} {t(lang,'blog_min_read')}</span>
                    <span style={{marginInlineStart:'auto',color:'#25D366',fontWeight:700}}>{t(lang,'blog_read')} →</span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* All posts */}
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:24}}>
          <span style={{width:3,height:18,background:'#25D366',borderRadius:2,display:'inline-block'}}/>
          <h2 style={{fontSize:20,fontWeight:700}}>{t(lang,'blog_all')}</h2>
        </div>
        <div className="grid">
          {rest.map(({ post, keys }) => (
            <Link key={post.slug} href={`/blog/${post.slug}`}>
              <div className="card">
                <div style={{height:160,overflow:'hidden',background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {post.image
                    ? <img src={post.image} alt={post.title} style={{width:'100%',height:'100%',objectFit:'cover',transition:'transform .3s'}} onMouseOver={e=>(e.currentTarget.style.transform='scale(1.05)')} onMouseOut={e=>(e.currentTarget.style.transform='scale(1)')} />
                    : <span style={{fontSize:52}}>{post.emoji}</span>
                  }
                </div>
                <div style={{padding:18,flex:1,display:'flex',flexDirection:'column'}}>
                  <span className="tag" style={{background: CAT_COLORS[keys.cat]||'#25D366',marginBottom:10,alignSelf:'flex-start'}}>{t(lang,keys.cat)}</span>
                  <h3 style={{fontSize:14,fontWeight:700,marginBottom:8,lineHeight:1.4,color:'#111b21',flex:1}}>{t(lang,keys.tk) || post.title}</h3>
                  <p style={{fontSize:12,color:'#54656f',lineHeight:1.6,marginBottom:12,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{t(lang,keys.ek) || post.excerpt}</p>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#8696a0'}}>
                    <span>{post.date}</span><span>{post.readTime} {t(lang,'blog_min_read')}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <PublicFooter lang={lang} />
    </>
  )
}
