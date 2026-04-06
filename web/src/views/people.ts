// 人物关系图谱页面

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

type Circle = {
  name: string
  description: string
  color: string
  members: { nickname: string; role: string; posts: number }[]
}

type Pair = {
  a: string
  b: string
  count: number
}

type KeyPerson = {
  nickname: string
  role: string
  trait: string
  posts: number
}

export function peopleView(
  circles: Circle[],
  topPairs: Pair[],
  keyPeople: KeyPerson[],
  timeline: { era: string; description: string; people: string[] }[]
): string {
  // Circles
  const circlesHtml = circles.map(c => {
    const members = c.members.map(m =>
      `<a href="/user/${encodeURIComponent(m.nickname)}" class="member-card">
        <span class="member-name">${escapeHtml(m.nickname)}</span>
        <span class="member-role">${escapeHtml(m.role)}</span>
       </a>`
    ).join('\n')

    return `
    <div class="circle-block" style="border-left: 3px solid ${c.color};">
      <h3 class="circle-title" style="color: ${c.color};">${escapeHtml(c.name)}</h3>
      <p class="circle-desc">${escapeHtml(c.description)}</p>
      <div class="member-grid">${members}</div>
    </div>`
  }).join('\n')

  // Top pairs
  const pairsHtml = topPairs.map((p, i) =>
    `<div class="pair-row">
      <span class="pair-rank">${i + 1}</span>
      <a href="/user/${encodeURIComponent(p.a)}">${escapeHtml(p.a)}</a>
      <span class="pair-arrow">↔</span>
      <a href="/user/${encodeURIComponent(p.b)}">${escapeHtml(p.b)}</a>
      <span class="pair-count">${p.count} 次互动</span>
    </div>`
  ).join('\n')

  // Key people
  const keyHtml = keyPeople.map(p =>
    `<a href="/user/${encodeURIComponent(p.nickname)}" class="key-card">
      <div class="key-name">${escapeHtml(p.nickname)}</div>
      <div class="key-role">${escapeHtml(p.role)}</div>
      <div class="key-trait">${escapeHtml(p.trait)}</div>
    </a>`
  ).join('\n')

  // Timeline
  const tlHtml = timeline.map(t =>
    `<div class="era-block">
      <div class="era-year">${escapeHtml(t.era)}</div>
      <div class="era-desc">${escapeHtml(t.description)}</div>
      <div class="era-people">${t.people.map(p =>
        `<a href="/user/${encodeURIComponent(p)}">${escapeHtml(p)}</a>`
      ).join(' · ')}</div>
    </div>`
  ).join('\n')

  const styles = `<style>
    .circle-block {
      padding: 16px 20px;
      margin-bottom: 24px;
      background: #fff;
      border-radius: 0 8px 8px 0;
      border: 1px solid #e8dfd0;
      border-left-width: 3px;
    }
    .circle-title { font-size: 1.1rem; margin-bottom: 4px; }
    .circle-desc { font-size: 0.85rem; color: #999; margin-bottom: 12px; }
    .member-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .member-card {
      display: inline-flex;
      flex-direction: column;
      padding: 6px 12px;
      background: #faf6ef;
      border: 1px solid #e8dfd0;
      border-radius: 6px;
      text-decoration: none;
      color: #333;
      font-size: 0.85rem;
      transition: border-color 0.2s;
    }
    .member-card:hover { border-color: #d4a574; }
    .member-name { font-weight: bold; color: #6b4226; }
    .member-role { font-size: 0.75rem; color: #aaa; }

    .pair-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid #f0ebe3;
      font-size: 0.9rem;
    }
    .pair-rank {
      width: 24px; height: 24px;
      display: flex; align-items: center; justify-content: center;
      background: #f5efe5; border-radius: 50%;
      font-size: 0.8rem; color: #999; flex-shrink: 0;
    }
    .pair-row a { color: #6b4226; text-decoration: none; font-weight: bold; }
    .pair-row a:hover { color: #d4a574; }
    .pair-arrow { color: #d4a574; }
    .pair-count { margin-left: auto; color: #999; font-size: 0.8rem; }

    .key-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
    }
    .key-card {
      padding: 14px;
      background: #fff;
      border: 1px solid #e8dfd0;
      border-radius: 8px;
      text-decoration: none;
      color: #333;
      text-align: center;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .key-card:hover { border-color: #d4a574; box-shadow: 0 2px 8px rgba(107,66,38,0.08); }
    .key-name { font-size: 1.05rem; font-weight: bold; color: #6b4226; }
    .key-role { font-size: 0.8rem; color: #d4a574; margin-top: 2px; }
    .key-trait { font-size: 0.78rem; color: #999; margin-top: 6px; line-height: 1.4; }

    .era-block {
      position: relative;
      padding: 12px 0 12px 24px;
      border-left: 2px solid #d4a574;
      margin-left: 8px;
      margin-bottom: 8px;
    }
    .era-block::before {
      content: '';
      position: absolute;
      left: -6px; top: 16px;
      width: 10px; height: 10px;
      background: #d4a574;
      border-radius: 50%;
      border: 2px solid #faf6ef;
    }
    .era-year { font-weight: bold; color: #6b4226; font-size: 0.95rem; }
    .era-desc { font-size: 0.85rem; color: #666; margin: 4px 0; }
    .era-people { font-size: 0.82rem; }
    .era-people a { color: #8b7355; text-decoration: none; }
    .era-people a:hover { color: #d4a574; }

    @media (max-width: 600px) {
      .key-grid { grid-template-columns: 1fr 1fr; }
      .pair-count { font-size: 0.7rem; }
    }
  </style>`

  return styles + `
    <h2 class="section-title">人物关系</h2>
    <p class="text-muted" style="text-align:center;margin-bottom:1.5rem;">十年间，2613 个人在咖啡里相遇、交谈、告别</p>

    <h3 class="section-title" style="font-size:1rem;margin-top:2rem;">关键人物</h3>
    <div class="key-grid">${keyHtml}</div>

    <h3 class="section-title" style="font-size:1rem;margin-top:2rem;">社交圈</h3>
    ${circlesHtml}

    <h3 class="section-title" style="font-size:1rem;margin-top:2rem;">最密切的关系</h3>
    <div class="card" style="padding: 8px 16px;">
      ${pairsHtml}
    </div>

    <h3 class="section-title" style="font-size:1rem;margin-top:2rem;">社交变迁</h3>
    ${tlHtml}
  `
}

// 硬编码的人物数据（从数据库分析得出）
export function getPeopleData() {
  const circles: Circle[] = [
    {
      name: '⚽ 咖啡足球圈',
      description: '互动最密集的群体，线下组织足球比赛',
      color: '#2e7d32',
      members: [
        { nickname: '双子文心', role: '灵魂人物 · 334篇', posts: 334 },
        { nickname: 'Suker', role: '铁搭档 · 286篇', posts: 286 },
        { nickname: 'nongmin', role: '组织者 · 140篇', posts: 140 },
        { nickname: 'ADAMS', role: '活跃球迷 · 157篇', posts: 157 },
        { nickname: '笨头鱼', role: '129篇', posts: 129 },
        { nickname: '潘采夫', role: '133篇', posts: 133 },
        { nickname: 'FIGO', role: '109篇', posts: 109 },
        { nickname: '吃钱怪', role: '138篇', posts: 138 },
        { nickname: 'Redondo', role: '116篇', posts: 116 },
        { nickname: '芋茹', role: '忠实观众 · 217回复', posts: 217 },
      ],
    },
    {
      name: '🏫 菁菁校园圈',
      description: '最大的版块社区，校园生活与青春故事',
      color: '#1565c0',
      members: [
        { nickname: '回声', role: '核心 · 215篇', posts: 215 },
        { nickname: '冰凌子', role: '核心 · 204篇', posts: 204 },
        { nickname: '游离态的鱼', role: '核心 · 193篇', posts: 193 },
        { nickname: '五叶桔', role: '核心 · 184篇', posts: 184 },
        { nickname: 'aB', role: '话题王 · 118篇', posts: 118 },
        { nickname: 'Pocahontas', role: '115篇', posts: 115 },
        { nickname: '阿十', role: '123篇', posts: 123 },
        { nickname: 'NPC', role: '93篇', posts: 93 },
        { nickname: 'Biby', role: '104篇', posts: 104 },
        { nickname: 'Different', role: '95篇', posts: 95 },
      ],
    },
    {
      name: '💌 情感驿站圈',
      description: '文艺气质，记录那些说不出口的话',
      color: '#c62828',
      members: [
        { nickname: 'sweetnik', role: '104篇', posts: 104 },
        { nickname: '樱如雪舞', role: '87篇 · 16个签名档', posts: 87 },
        { nickname: '凡妮', role: '63篇', posts: 63 },
        { nickname: '柠檬小S', role: '72篇 · 13个签名档', posts: 72 },
        { nickname: 'konna', role: '58篇', posts: 58 },
        { nickname: 'loveyou_jj', role: '51篇', posts: 51 },
      ],
    },
    {
      name: '☕ 原味咖啡 · 元老圈',
      description: '最早的一批人，以文字见长',
      color: '#6b4226',
      members: [
        { nickname: 'LuDo', role: '站长 · 1998-', posts: 205 },
        { nickname: 'Kitty', role: '元老 · 1999-', posts: 73 },
        { nickname: '寻常百姓', role: '元老 · 1998-', posts: 56 },
        { nickname: '回声', role: '元老 · 1999-', posts: 319 },
        { nickname: '水灵光', role: '元老 · 1999-', posts: 31 },
        { nickname: 'lazybone', role: '写手 · 112篇', posts: 112 },
        { nickname: 'grassgirl', role: '元老', posts: 57 },
        { nickname: '夜猫子', role: '元老', posts: 25 },
      ],
    },
    {
      name: '✏️ 心情涂鸦圈',
      description: '随手写下的心情碎片',
      color: '#7b1fa2',
      members: [
        { nickname: '舞月光', role: '117篇', posts: 117 },
        { nickname: 'kain', role: '96篇', posts: 96 },
        { nickname: '淡如茶', role: '58篇', posts: 58 },
        { nickname: '紫风', role: '44篇', posts: 44 },
      ],
    },
    {
      name: '💧 灌水乐园',
      description: '什么都可以聊的快乐之地',
      color: '#0277bd',
      members: [
        { nickname: 'aiyo', role: '灌水之王 · 96篇', posts: 96 },
        { nickname: '可口可乐', role: '18个签名档 · 58篇', posts: 58 },
        { nickname: 'flounder', role: '44篇', posts: 44 },
        { nickname: 'coca_cola', role: '34篇', posts: 34 },
      ],
    },
  ]

  const topPairs: Pair[] = [
    { a: '双子文心', b: 'Suker', count: 126 },
    { a: '双子文心', b: 'nongmin', count: 91 },
    { a: '双子文心', b: '芋茹', count: 89 },
    { a: '双子文心', b: 'ADAMS', count: 75 },
    { a: '双子文心', b: '笨头鱼', count: 64 },
    { a: '双子文心', b: '吃钱怪', count: 63 },
    { a: '双子文心', b: '潘采夫', count: 60 },
    { a: 'footballboy', b: '双子文心', count: 53 },
    { a: '双子文心', b: 'FIGO', count: 51 },
    { a: '双子文心', b: '紫风', count: 48 },
    { a: 'aiyo', b: '芋茹', count: 47 },
    { a: 'aB', b: 'amok', count: 46 },
    { a: 'nongmin', b: 'Suker', count: 45 },
    { a: 'coffeesf8', b: 'xxboy', count: 42 },
    { a: '冰凌子', b: '游离态的鱼', count: 29 },
  ]

  const keyPeople: KeyPerson[] = [
    { nickname: '双子文心', role: '足球版灵魂', trait: '与 20+ 人深度互动，全站社交中心', posts: 412 },
    { nickname: '芋茹', role: '回复之王', trait: '645 篇几乎全是回复，横跨所有版块', posts: 645 },
    { nickname: 'LuDo', role: '站长', trait: '1998 年创站，守护咖啡十年', posts: 205 },
    { nickname: '回声', role: '校园版核心', trait: '1999 年入驻，与冰凌子、游离态的鱼关系密切', posts: 319 },
    { nickname: 'Stovic', role: '全能型', trait: '横跨小说、足球、校园等多个版块', posts: 433 },
    { nickname: 'nongmin', role: '足球组织者', trait: '组织线下足球赛，足球+站务活跃', posts: 258 },
    { nickname: 'aiyo', role: '灌水之王', trait: '2003 年加入后活跃在每一个角落', posts: 459 },
    { nickname: '冰凌子', role: '校园才女', trait: '与游离态的鱼、Different 互动紧密', posts: 212 },
  ]

  const timeline = [
    {
      era: '1998 — 2000',
      description: '小圈子时期，元老们在湖滨南路的咖啡屋里相遇',
      people: ['LuDo', '寻常百姓', '回声', 'Kitty', '水灵光', 'POPEYE'],
    },
    {
      era: '2001',
      description: '大量新人涌入，社交圈开始成形',
      people: ['双子文心', '芋茹', 'nongmin', 'Suker', '柠檬小S', 'ADAMS', '轩雅', '冰凌子', '游离态的鱼'],
    },
    {
      era: '2002',
      description: '最活跃时期，多个版块社交圈并行繁荣',
      people: ['sweetnik', '樱如雪舞', 'kain', 'amok', '阿树', 'FIGO', '艾布衣', 'Pocahontas'],
    },
    {
      era: '2003 — 2004',
      description: '最后一波活跃用户加入，之后社区渐渐安静',
      people: ['aiyo', '可口可乐', 'aB', 'Jennie', 'ka', 'cafewooya'],
    },
  ]

  return { circles, topPairs, keyPeople, timeline }
}
