export function aboutView(): string {
  const people = [
    { name: 'LuDo', role: '站长' },
    { name: 'Coffee', role: '管理员' },
    { name: '寻常百姓', role: '元老' },
    { name: 'grassgirl', role: '元老' },
    { name: '回声', role: '元老\u00b7309篇' },
    { name: '夜猫子', role: '元老' },
    { name: '芋茹', role: '最活跃\u00b7630篇' },
    { name: 'aiyo', role: '活跃\u00b7458篇' },
    { name: 'Stovic', role: '活跃\u00b7414篇' },
    { name: '双子文心', role: '活跃\u00b7399篇' },
    { name: '水灵光', role: '元老' },
    { name: 'Kitty', role: '元老' },
  ]

  const peopleGrid = people
    .map(
      (p) =>
        `<a href="/user/${encodeURIComponent(p.name)}" class="about-person-card">
          <span class="about-person-name">${p.name}</span>
          <span class="about-person-role">${p.role}</span>
        </a>`
    )
    .join('\n')

  return `
<style>
  .about-intro {
    margin-bottom: 2rem;
  }
  .about-intro h2 {
    font-size: 1.3rem;
    color: #6b4226;
    margin-bottom: 0.5rem;
  }
  .about-intro p {
    font-style: italic;
    color: #666;
    line-height: 1.8;
  }

  /* Timeline */
  .about-timeline {
    position: relative;
    padding-left: 2rem;
    border-left: 2px solid #d4a574;
    margin: 2rem 0;
  }
  .about-milestone {
    position: relative;
    margin-bottom: 2.5rem;
  }
  .about-milestone::before {
    content: '';
    position: absolute;
    left: -2.45rem;
    top: 0.35rem;
    width: 10px;
    height: 10px;
    background: #d4a574;
    border-radius: 50%;
    border: 2px solid #faf6ef;
  }
  .about-milestone h3 {
    font-size: 1.1rem;
    color: #6b4226;
    margin-bottom: 0.4rem;
  }
  .about-milestone p {
    color: #555;
    margin-bottom: 0.75rem;
    line-height: 1.7;
  }
  .about-milestone img {
    max-width: 100%;
    border-radius: 6px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    margin-bottom: 0.25rem;
  }
  .about-milestone .caption {
    font-size: 0.8rem;
    color: #999;
    margin-bottom: 0.5rem;
  }
  .about-quote {
    border-left: 3px solid #d4a574;
    padding: 0.5rem 1rem;
    margin: 0.75rem 0;
    font-style: italic;
    color: #888;
    background: rgba(212, 165, 116, 0.06);
    border-radius: 0 4px 4px 0;
  }

  /* People section */
  .about-people {
    margin-top: 2.5rem;
  }
  .about-people h3 {
    font-size: 1.1rem;
    color: #6b4226;
    margin-bottom: 0.25rem;
  }
  .about-people .subtitle {
    font-size: 0.85rem;
    color: #999;
    margin-bottom: 1rem;
  }
  .about-people-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .about-person-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem 0.5rem;
    background: #fff;
    border: 1px solid #e8dfd0;
    border-radius: 6px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .about-person-card:hover {
    border-color: #d4a574;
    box-shadow: 0 2px 8px rgba(212, 165, 116, 0.2);
  }
  .about-person-name {
    font-size: 0.95rem;
    color: #6b4226;
    font-weight: bold;
  }
  .about-person-role {
    font-size: 0.75rem;
    color: #999;
    margin-top: 0.15rem;
  }
  .about-people-note {
    text-align: center;
    color: #999;
    font-size: 0.85rem;
    margin-top: 0.5rem;
  }
</style>

<div class="about-intro">
  <h2>关于咖啡</h2>
  <p>这是一个关于厦门、关于青春、关于一杯咖啡的故事。1998 — 2008，十年间，2613 个人在这里写下了 2923 篇文字。</p>
</div>

<div class="about-timeline">

  <div class="about-milestone">
    <h3>1998</h3>
    <p>厦门湖滨南路的一家网吧里，厦门因特咖啡屋诞生了。域名挂在厦门信息港下：www.intercafe.xm.fj.cn。那时上网每小时 10 元。</p>
    <img src="/screenshots/1999-intercafe-homepage.png" alt="1999年因特咖啡屋首页">
    <div class="caption">1999年1月首页快照</div>
  </div>

  <div class="about-milestone">
    <h3>2000</h3>
    <p>千禧年。首页换上了橙色暖调。</p>
    <img src="/screenshots/2000-intercafe-homepage.png" alt="2000年因特咖啡屋首页">
  </div>

  <div class="about-milestone">
    <h3>2001</h3>
    <p>5月，LuDo 发起域名投票，70多位网友讨论了数十个候选名。最终 cafewoo.net 胜出 — woo 取自"屋"的谐音。9月，咖啡三周年。</p>
    <div class="about-quote">咖啡曾经清清静静，后来熙熙攘攘…… — 寻常百姓</div>
    <img src="/screenshots/2001-cafewoo-homepage.png" alt="2001年咖啡屋首页">
  </div>

  <div class="about-milestone">
    <h3>2002</h3>
    <p>社区最活跃的一年。向日葵盛开在首页，标语 One More Cup of Coffee。</p>
    <img src="/screenshots/2002-cafewoo-homepage.png" alt="2002年咖啡屋首页">
  </div>

  <div class="about-milestone">
    <h3>2003</h3>
    <p>企鹅照片配文：天固然冷，我们还是要象企鹅般生活着……送给所有热爱咖啡的人。</p>
    <img src="/screenshots/2003-cafewoo-homepage.png" alt="2003年咖啡屋首页">
  </div>

  <div class="about-milestone">
    <h3>2004</h3>
    <p>Tom's Dinner。底部写着 CafeFans 1998-2003 (Five Years)。</p>
    <img src="/screenshots/2004-cafewoo-homepage.png" alt="2004年咖啡屋首页">
  </div>

  <div class="about-milestone">
    <h3>2006 — 2008</h3>
    <p>网站改版，增加了咖啡电台、相册、小组。老用户偶尔回来。</p>
    <div class="about-quote">年三十...突然很想听起当年的随身听...~咖啡，我回来了。— 2008年春节</div>
    <img src="/screenshots/2008-cafewoo-last.png" alt="2008年咖啡屋最后的首页">
  </div>

  <div class="about-milestone">
    <h3>2026</h3>
    <p>二十多年后，从 Web Archive 找回了这些页面。2923 篇帖子重新上线。</p>
    <div class="about-quote">咖啡是一出没有终点的电影！！！—— 陈陈</div>
  </div>

</div>

<div class="about-people">
  <h3>那些人</h3>
  <div class="subtitle">建设和守护咖啡的人们</div>
  <div class="about-people-grid">
    ${peopleGrid}
  </div>
  <div class="about-people-note">以及 2568 位在咖啡里留下文字的朋友</div>
</div>
`
}
