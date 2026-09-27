const UNSPLASH_PARAMS = '?auto=format&fit=crop&w=1000&q=85';
const photo = (id) => `https://images.unsplash.com/photo-${id}${UNSPLASH_PARAMS}`;

export const seedProducts = [
  {
    id: 'brand-starter-kit',
    name: 'Brand Starter Kit',
    category: 'Brand',
    price: 2400,
    blurb: 'Logo suite, color system, type pairing, and a one-page guideline your team can actually use.',
    tone: 'cobalt',
    glyph: '✳',
    badge: 'Best seller'
  },
  {
    id: 'logo-refresh',
    name: 'Logo Refresh',
    category: 'Brand',
    price: 900,
    blurb: 'A sharpened version of the mark you already own, delivered in every format you will ever need.',
    image: photo('1626785774573-4b799315345d')
  },
  {
    id: 'landing-page-kit',
    name: 'Landing Page Kit',
    category: 'Digital',
    price: 600,
    blurb: 'A conversion-ready page design with copy prompts, components, and a clean handoff file.',
    tone: 'lime',
    glyph: '◒',
    badge: 'New'
  },
  {
    id: 'website-design-sprint',
    name: 'Website Design Sprint',
    category: 'Digital',
    price: 3500,
    blurb: 'Two focused weeks to map, design, and prototype the site your product deserves.',
    tone: 'ink',
    glyph: '◆'
  },
  {
    id: 'social-launch-pack',
    name: 'Social Launch Pack',
    category: 'Campaign',
    price: 750,
    blurb: 'Twelve ready-to-post templates for the week you ship, built around one strong idea.',
    image: photo('1611926653458-09294b3142bf')
  },
  {
    id: 'content-calendar',
    name: 'Content Calendar',
    category: 'Campaign',
    price: 400,
    blurb: 'A three-month plan with themes, formats, and prompts so publishing stops feeling like a scramble.',
    tone: 'orange',
    glyph: '▦'
  },
  {
    id: 'icon-illustration-set',
    name: 'Icon & Illustration Set',
    category: 'Assets',
    price: 300,
    blurb: 'Twenty-four custom icons or spot illustrations drawn in one consistent visual language.',
    tone: 'paper',
    glyph: '❍'
  },
  {
    id: 'type-pairing-guide',
    name: 'Type Pairing Guide',
    category: 'Assets',
    price: 180,
    blurb: 'Two typefaces, five pairings, and the scale to keep every screen readable and on brand.',
    tone: 'cobalt',
    glyph: 'Aa',
    badge: 'Quick win'
  },
  {
    id: 'naming-session',
    name: 'Naming Session',
    category: 'Brand',
    price: 1200,
    blurb: 'A half-day workshop that leaves you with three name routes, checked and ready to defend.',
    tone: 'lime',
    glyph: '✦'
  }
];
