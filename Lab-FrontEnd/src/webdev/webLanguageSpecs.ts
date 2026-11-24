import type { TagSpec } from '@codemirror/lang-html'

const TARGETS = ['_blank', '_self', '_parent', '_top'] as const
const BOOL_TRUE_FALSE = ['true', 'false'] as const
const CROSSORIGIN = ['anonymous', 'use-credentials'] as const
const REFERRER_POLICY = [
  'no-referrer',
  'no-referrer-when-downgrade',
  'origin',
  'origin-when-cross-origin',
  'same-origin',
  'strict-origin',
  'strict-origin-when-cross-origin',
  'unsafe-url',
] as const
const FETCH_PRIORITY = ['high', 'low', 'auto'] as const
const LOADING = ['lazy', 'eager'] as const
const DECODING = ['async', 'sync', 'auto'] as const
const AUTOCOMPLETE = [
  'on', 'off', 'name', 'given-name', 'family-name', 'email', 'username',
  'new-password', 'current-password', 'one-time-code', 'organization',
  'street-address', 'postal-code', 'country', 'tel', 'url', 'bday',
] as const
const INPUT_MODES = ['none', 'text', 'decimal', 'numeric', 'tel', 'search', 'email', 'url'] as const
const ENTER_KEY_HINTS = ['enter', 'done', 'go', 'next', 'previous', 'search', 'send'] as const
const FORM_METHODS = ['get', 'post', 'dialog'] as const
const FORM_ENCS = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'] as const
const LINK_RELS = [
  'stylesheet', 'icon', 'preload', 'prefetch', 'preconnect', 'dns-prefetch',
  'modulepreload', 'canonical', 'manifest', 'alternate', 'author', 'help',
  'license', 'next', 'prev', 'search',
] as const
const ANCHOR_RELS = [
  'noopener', 'noreferrer', 'nofollow', 'external', 'bookmark', 'help',
  'license', 'next', 'prev', 'tag', 'ugc', 'sponsored',
] as const
const LINK_AS = [
  'audio', 'document', 'embed', 'fetch', 'font', 'image', 'object',
  'script', 'style', 'track', 'video', 'worker',
] as const
const POPOVER_ACTIONS = ['toggle', 'show', 'hide'] as const
const SVG_COMMON_ATTRS: Record<string, null | readonly string[]> = {
  id: null,
  class: null,
  style: null,
  fill: ['none', 'currentColor', 'transparent'],
  'fill-opacity': null,
  'fill-rule': ['nonzero', 'evenodd'],
  stroke: ['none', 'currentColor', 'transparent'],
  'stroke-width': null,
  'stroke-opacity': null,
  'stroke-linecap': ['butt', 'round', 'square'],
  'stroke-linejoin': ['miter', 'round', 'bevel'],
  'stroke-dasharray': null,
  'stroke-dashoffset': null,
  opacity: null,
  transform: null,
  'clip-path': null,
  mask: null,
  filter: null,
}

/**
 * Extra DOM event attributes not included in @codemirror/lang-html's default eventAttributes.
 * Registered both as global HTML attributes AND nested JavaScript attribute parsers.
 */
export const HTML_EXTRA_EVENT_ATTRS: readonly string[] = [
  'onabort',
  'onanimationcancel',
  'onanimationend',
  'onanimationiteration',
  'onanimationstart',
  'onauxclick',
  'onbeforeinput',
  'onbeforetoggle',
  'oncancel',
  'oncanplay',
  'oncanplaythrough',
  'onclose',
  'oncontextmenu',
  'oncuechange',
  'ondblclick',
  'ondurationchange',
  'onemptied',
  'onended',
  'onerror',
  'onfocusin',
  'onfocusout',
  'onformdata',
  'onhashchange',
  'oninput',
  'oninvalid',
  'onloadeddata',
  'onloadedmetadata',
  'onloadstart',
  'onmousemove',
  'onmouseout',
  'onmouseover',
  'onoffline',
  'ononline',
  'onpagehide',
  'onpageshow',
  'onpause',
  'onplay',
  'onplaying',
  'onpointercancel',
  'onpointerdown',
  'onpointerenter',
  'onpointerleave',
  'onpointermove',
  'onpointerout',
  'onpointerover',
  'onpointerup',
  'onpopstate',
  'onprogress',
  'onratechange',
  'onreset',
  'onsecuritypolicyviolation',
  'onseeked',
  'onseeking',
  'onselect',
  'onslotchange',
  'onstalled',
  'onstorage',
  'onsubmit',
  'onsuspend',
  'ontimeupdate',
  'ontoggle',
  'ontouchcancel',
  'ontouchend',
  'ontouchmove',
  'ontouchstart',
  'ontransitioncancel',
  'ontransitionend',
  'ontransitionrun',
  'ontransitionstart',
  'onvisibilitychange',
  'onvolumechange',
  'onwaiting',
  'onwheel',
]

/**
 * Complete modern HTML5 + SVG tag overrides/additions passed into `@codemirror/lang-html`
 * so built-in tag, attribute, and attribute-value completion covers the full HTML Living Standard.
 */
export const HTML_EXTRA_TAGS: Record<string, TagSpec> = {
  html: { attrs: { lang: ['id', 'en', 'en-US', 'ar', 'ja', 'zh', 'fr', 'de', 'es'], dir: ['ltr', 'rtl', 'auto'], xmlns: ['http://www.w3.org/1999/xhtml'] } },
  head: { children: ['title', 'base', 'link', 'style', 'meta', 'script', 'noscript', 'template'] },
  main: {},
  search: {},
  s: {},
  u: {},
  h1: {},
  h2: {},
  h3: {},
  h4: {},
  h5: {},
  h6: {},
  hgroup: {},
  dialog: {
    attrs: {
      open: ['open'],
      closedby: ['any', 'closerequest', 'none'],
    },
  },
  details: {
    attrs: {
      open: ['open'],
      name: null,
    },
  },
  picture: {
    children: ['source', 'img', 'script', 'template'],
  },
  template: {
    attrs: {
      shadowrootmode: ['open', 'closed'],
      shadowrootdelegatesfocus: ['shadowrootdelegatesfocus'],
      shadowrootclonable: ['shadowrootclonable'],
      shadowrootserializable: ['shadowrootserializable'],
    },
  },
  datalist: {
    children: ['option', 'script', 'template'],
  },
  a: {
    attrs: {
      href: null,
      target: TARGETS,
      rel: ANCHOR_RELS,
      download: null,
      hreflang: null,
      type: null,
      ping: null,
      referrerpolicy: REFERRER_POLICY,
    },
  },
  img: {
    attrs: {
      src: null,
      alt: null,
      width: null,
      height: null,
      srcset: null,
      sizes: null,
      loading: LOADING,
      decoding: DECODING,
      fetchpriority: FETCH_PRIORITY,
      crossorigin: CROSSORIGIN,
      referrerpolicy: REFERRER_POLICY,
      ismap: ['ismap'],
      usemap: null,
      elementtiming: null,
    },
  },
  link: {
    attrs: {
      rel: LINK_RELS,
      href: null,
      as: LINK_AS,
      type: null,
      media: null,
      sizes: ['any', '16x16', '32x32', '180x180', '192x192', '512x512'],
      crossorigin: CROSSORIGIN,
      integrity: null,
      referrerpolicy: REFERRER_POLICY,
      fetchpriority: FETCH_PRIORITY,
      blocking: ['render'],
      disabled: ['disabled'],
      imagesrcset: null,
      imagesizes: null,
      hreflang: null,
      title: null,
    },
  },
  meta: {
    attrs: {
      charset: ['UTF-8', 'utf-8'],
      name: [
        'viewport', 'description', 'author', 'keywords', 'robots',
        'theme-color', 'color-scheme', 'referrer', 'application-name', 'generator',
      ],
      property: ['og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'og:site_name'],
      content: null,
      'http-equiv': ['content-type', 'default-style', 'refresh', 'x-ua-compatible', 'content-security-policy'],
      media: null,
    },
  },
  script: {
    attrs: {
      src: null,
      type: ['module', 'text/javascript', 'importmap', 'speculationrules'],
      async: ['async'],
      defer: ['defer'],
      nomodule: ['nomodule'],
      crossorigin: CROSSORIGIN,
      integrity: null,
      referrerpolicy: REFERRER_POLICY,
      fetchpriority: FETCH_PRIORITY,
      blocking: ['render'],
      nonce: null,
    },
  },
  style: {
    attrs: {
      media: null,
      blocking: ['render'],
      nonce: null,
      type: ['text/css'],
    },
  },
  button: {
    attrs: {
      type: ['button', 'submit', 'reset'],
      name: null,
      value: null,
      disabled: ['disabled'],
      autofocus: ['autofocus'],
      form: null,
      formaction: null,
      formenctype: FORM_ENCS,
      formmethod: FORM_METHODS,
      formnovalidate: ['formnovalidate'],
      formtarget: TARGETS,
      popovertarget: null,
      popovertargetaction: POPOVER_ACTIONS,
      command: ['show-modal', 'close', 'toggle-popover', 'show-popover', 'hide-popover'],
      commandfor: null,
    },
  },
  input: {
    attrs: {
      type: [
        'text', 'email', 'password', 'number', 'search', 'tel', 'url',
        'checkbox', 'radio', 'date', 'datetime-local', 'time', 'month', 'week',
        'range', 'color', 'file', 'hidden', 'submit', 'reset', 'button', 'image',
      ],
      name: null,
      value: null,
      placeholder: null,
      required: ['required'],
      disabled: ['disabled'],
      readonly: ['readonly'],
      checked: ['checked'],
      autofocus: ['autofocus'],
      autocomplete: AUTOCOMPLETE,
      min: null,
      max: null,
      step: null,
      minlength: null,
      maxlength: null,
      pattern: null,
      multiple: ['multiple'],
      accept: ['image/*', 'audio/*', 'video/*', '.pdf', '.csv', '.json'],
      capture: ['user', 'environment'],
      list: null,
      size: null,
      src: null,
      alt: null,
      width: null,
      height: null,
      dirname: null,
      inputmode: INPUT_MODES,
      enterkeyhint: ENTER_KEY_HINTS,
      popovertarget: null,
      popovertargetaction: POPOVER_ACTIONS,
      form: null,
      formaction: null,
      formenctype: FORM_ENCS,
      formmethod: FORM_METHODS,
      formnovalidate: ['formnovalidate'],
      formtarget: TARGETS,
    },
  },
  form: {
    attrs: {
      action: null,
      method: FORM_METHODS,
      enctype: FORM_ENCS,
      autocomplete: ['on', 'off'],
      novalidate: ['novalidate'],
      target: TARGETS,
      name: null,
      rel: ANCHOR_RELS,
      'accept-charset': ['UTF-8'],
    },
  },
  select: {
    attrs: {
      name: null,
      form: null,
      size: null,
      multiple: ['multiple'],
      required: ['required'],
      disabled: ['disabled'],
      autofocus: ['autofocus'],
      autocomplete: AUTOCOMPLETE,
    },
  },
  textarea: {
    attrs: {
      name: null,
      rows: null,
      cols: null,
      placeholder: null,
      minlength: null,
      maxlength: null,
      required: ['required'],
      disabled: ['disabled'],
      readonly: ['readonly'],
      autofocus: ['autofocus'],
      autocomplete: AUTOCOMPLETE,
      wrap: ['soft', 'hard'],
      dirname: null,
      form: null,
    },
  },
  iframe: {
    attrs: {
      src: null,
      srcdoc: null,
      name: null,
      width: null,
      height: null,
      allow: null,
      allowfullscreen: ['allowfullscreen'],
      loading: LOADING,
      referrerpolicy: REFERRER_POLICY,
      credentialless: ['credentialless'],
      sandbox: [
        'allow-forms', 'allow-modals', 'allow-popups', 'allow-same-origin',
        'allow-scripts', 'allow-top-navigation', 'allow-downloads',
      ],
    },
  },
  video: {
    attrs: {
      src: null,
      poster: null,
      width: null,
      height: null,
      controls: ['controls'],
      autoplay: ['autoplay'],
      loop: ['loop'],
      muted: ['muted'],
      playsinline: ['playsinline'],
      preload: ['none', 'metadata', 'auto'],
      crossorigin: CROSSORIGIN,
      disablepictureinpicture: ['disablepictureinpicture'],
      disableremoteplayback: ['disableremoteplayback'],
      controlslist: ['nodownload', 'nofullscreen', 'noremoteplayback'],
    },
  },
  audio: {
    attrs: {
      src: null,
      controls: ['controls'],
      autoplay: ['autoplay'],
      loop: ['loop'],
      muted: ['muted'],
      preload: ['none', 'metadata', 'auto'],
      crossorigin: CROSSORIGIN,
      disableremoteplayback: ['disableremoteplayback'],
      controlslist: ['nodownload', 'noremoteplayback'],
    },
  },
  source: {
    attrs: {
      src: null,
      srcset: null,
      sizes: null,
      type: null,
      media: null,
      width: null,
      height: null,
    },
  },
  svg: {
    attrs: {
      ...SVG_COMMON_ATTRS,
      viewBox: null,
      xmlns: ['http://www.w3.org/2000/svg'],
      width: null,
      height: null,
      preserveAspectRatio: ['xMidYMid meet', 'xMidYMid slice', 'none'],
    },
  },
  path: { attrs: { ...SVG_COMMON_ATTRS, d: null, pathLength: null } },
  circle: { attrs: { ...SVG_COMMON_ATTRS, cx: null, cy: null, r: null } },
  ellipse: { attrs: { ...SVG_COMMON_ATTRS, cx: null, cy: null, rx: null, ry: null } },
  rect: { attrs: { ...SVG_COMMON_ATTRS, x: null, y: null, width: null, height: null, rx: null, ry: null } },
  line: { attrs: { ...SVG_COMMON_ATTRS, x1: null, y1: null, x2: null, y2: null } },
  polyline: { attrs: { ...SVG_COMMON_ATTRS, points: null } },
  polygon: { attrs: { ...SVG_COMMON_ATTRS, points: null } },
  g: { attrs: { ...SVG_COMMON_ATTRS } },
  defs: { attrs: { id: null } },
  use: { attrs: { ...SVG_COMMON_ATTRS, href: null, x: null, y: null, width: null, height: null } },
  symbol: { attrs: { id: null, viewBox: null, preserveAspectRatio: null } },
  linearGradient: { attrs: { id: null, x1: null, y1: null, x2: null, y2: null, gradientUnits: ['userSpaceOnUse', 'objectBoundingBox'], gradientTransform: null } },
  radialGradient: { attrs: { id: null, cx: null, cy: null, r: null, fx: null, fy: null, gradientUnits: ['userSpaceOnUse', 'objectBoundingBox'] } },
  stop: { attrs: { offset: null, 'stop-color': null, 'stop-opacity': null } },
  text: { attrs: { ...SVG_COMMON_ATTRS, x: null, y: null, dx: null, dy: null, 'font-size': null, 'font-family': null, 'font-weight': null, 'text-anchor': ['start', 'middle', 'end'], 'dominant-baseline': ['auto', 'middle', 'central', 'hanging'] } },
  tspan: { attrs: { ...SVG_COMMON_ATTRS, x: null, y: null, dx: null, dy: null } },
  clipPath: { attrs: { id: null, clipPathUnits: ['userSpaceOnUse', 'objectBoundingBox'] } },
  mask: { attrs: { id: null, x: null, y: null, width: null, height: null } },
  filter: { attrs: { id: null, x: null, y: null, width: null, height: null } },
  foreignObject: { attrs: { x: null, y: null, width: null, height: null } },
  image: { attrs: { href: null, x: null, y: null, width: null, height: null, preserveAspectRatio: null } },
  animate: { attrs: { attributeName: null, from: null, to: null, values: null, dur: null, repeatCount: ['indefinite'] } },
  desc: { attrs: {} },
  math: { attrs: { display: ['block', 'inline'], xmlns: ['http://www.w3.org/1998/Math/MathML'] } },
}

/** Modern global HTML5 attributes, WAI-ARIA 1.2 attributes, and extra DOM event handlers. */
export const HTML_EXTRA_GLOBAL_ATTRIBUTES: Record<string, null | readonly string[]> = {
  autofocus: ['autofocus'],
  popover: ['auto', 'manual', 'hint'],
  inputmode: INPUT_MODES,
  enterkeyhint: ENTER_KEY_HINTS,
  autocapitalize: ['off', 'none', 'on', 'sentences', 'words', 'characters'],
  is: null,
  slot: null,
  part: null,
  exportparts: null,
  nonce: null,
  anchor: null,
  virtualkeyboardpolicy: ['auto', 'manual'],
  writingsuggestions: BOOL_TRUE_FALSE,
  'data-': null,
  'aria-braillelabel': null,
  'aria-brailleroledescription': null,
  'aria-colcount': null,
  'aria-colindex': null,
  'aria-colindextext': null,
  'aria-colspan': null,
  'aria-current': ['page', 'step', 'location', 'date', 'time', 'true', 'false'],
  'aria-description': null,
  'aria-details': null,
  'aria-errormessage': null,
  'aria-haspopup': ['false', 'true', 'menu', 'listbox', 'tree', 'grid', 'dialog'],
  'aria-hidden': BOOL_TRUE_FALSE,
  'aria-keyshortcuts': null,
  'aria-modal': BOOL_TRUE_FALSE,
  'aria-orientation': ['horizontal', 'vertical'],
  'aria-placeholder': null,
  'aria-roledescription': null,
  'aria-rowcount': null,
  'aria-rowindex': null,
  'aria-rowindextext': null,
  'aria-rowspan': null,
  ...Object.fromEntries(HTML_EXTRA_EVENT_ATTRS.map((attr) => [attr, null])),
}

export const HTML_VOID_TAG_SET = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

export const HTML_BOOLEAN_ATTR_SET = new Set([
  'allowfullscreen', 'async', 'autofocus', 'autoplay', 'checked', 'controls',
  'credentialless', 'default', 'defer', 'disabled', 'disablepictureinpicture',
  'disableremoteplayback', 'formnovalidate', 'hidden', 'inert', 'ismap',
  'itemscope', 'loop', 'multiple', 'muted', 'nomodule', 'novalidate', 'open',
  'playsinline', 'readonly', 'required', 'reversed', 'selected',
  'shadowrootclonable', 'shadowrootdelegatesfocus', 'shadowrootserializable',
])

/** Complete standard HTML5 + SVG element catalog for Emmet-style tag completion and CSS tag selectors. */
export const ALL_HTML_TAG_NAMES: readonly string[] = [
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio',
  'b', 'base', 'bdi', 'bdo', 'blockquote', 'body', 'br', 'button',
  'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
  'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt',
  'em', 'embed',
  'fieldset', 'figcaption', 'figure', 'footer', 'form',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html',
  'i', 'iframe', 'img', 'input', 'ins',
  'kbd',
  'label', 'legend', 'li', 'link',
  'main', 'map', 'mark', 'math', 'menu', 'meta', 'meter',
  'nav', 'noscript',
  'object', 'ol', 'optgroup', 'option', 'output',
  'p', 'picture', 'pre', 'progress',
  'q',
  'rp', 'rt', 'ruby',
  's', 'samp', 'script', 'search', 'section', 'select', 'slot', 'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup', 'svg',
  'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track',
  'u', 'ul',
  'var', 'video',
  'wbr',
]

export const ALL_SVG_TAG_NAMES: readonly string[] = [
  'svg', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon',
  'g', 'defs', 'use', 'symbol', 'linearGradient', 'radialGradient', 'stop',
  'text', 'tspan', 'clipPath', 'mask', 'filter', 'foreignObject', 'image', 'animate', 'desc',
]

/** Concise bilingual descriptions for HTML5 tags (used in tag completion tooltips). */
export const HTML_TAG_DESCRIPTIONS: Record<string, [string, string]> = {
  html: ['Elemen akar dokumen HTML', 'Root HTML document element'],
  head: ['Metadata, judul, link CSS, dan script dokumen', 'Document metadata container'],
  body: ['Konten utama yang ditampilkan di halaman', 'Visible document body'],
  title: ['Judul tab browser dokumen HTML', 'Browser tab document title'],
  meta: ['Metadata dokumen (charset, viewport, SEO)', 'Document metadata element'],
  link: ['Tautan stylesheet CSS atau ikon eksternal', 'External resource link (stylesheet, icon)'],
  base: ['URL dasar untuk tautan relatif', 'Base URL for relative links'],
  style: ['Blok CSS internal di dalam HTML', 'Embedded CSS stylesheet block'],
  script: ['Blok atau tautan JavaScript', 'Embedded or external JavaScript'],
  noscript: ['Konten cadangan saat JavaScript nonaktif', 'Fallback content when JS is disabled'],
  header: ['Header halaman atau bagian atas', 'Page or section header'],
  nav: ['Wadah tautan navigasi utama', 'Navigation links container'],
  main: ['Konten utama dokumen HTML5', 'Main document content'],
  section: ['Seksi konten tematik terstruktur', 'Thematic content section'],
  article: ['Konten artikel mandiri', 'Self-contained article block'],
  aside: ['Konten samping/sidebar semantik', 'Complementary sidebar content'],
  footer: ['Catatan kaki halaman atau seksi', 'Page or section footer'],
  search: ['Area pencarian atau filter semantik', 'Semantic search or filtering region'],
  hgroup: ['Pengelompokan judul dan subjudul', 'Heading and subheading group'],
  h1: ['Judul utama tingkat 1', 'Heading level 1'],
  h2: ['Subjudul tingkat 2', 'Heading level 2'],
  h3: ['Subjudul tingkat 3', 'Heading level 3'],
  h4: ['Subjudul tingkat 4', 'Heading level 4'],
  h5: ['Subjudul tingkat 5', 'Heading level 5'],
  h6: ['Subjudul tingkat 6', 'Heading level 6'],
  p: ['Paragraf teks', 'Text paragraph'],
  div: ['Wadah blok div umum', 'Generic block container'],
  span: ['Wadah teks sebaris (inline)', 'Generic inline text container'],
  a: ['Tautan hyperlink navigasi', 'Anchor hyperlink'],
  img: ['Menampilkan gambar dengan teks alt', 'Image element with alt text'],
  picture: ['Gambar responsif dengan banyak <source>', 'Responsive image container'],
  figure: ['Konten media/diagram mandiri', 'Self-contained figure/media'],
  figcaption: ['Keterangan teks untuk <figure>', 'Caption for a <figure>'],
  blockquote: ['Kutipan panjang terpisah', 'Extended block quotation'],
  pre: ['Teks terformat persis (spasi & baris baru)', 'Preformatted text block'],
  code: ['Potongan kode inline', 'Inline code fragment'],
  strong: ['Penekanan teks penting (tebal)', 'Strong importance text'],
  em: ['Penekanan teks (miring)', 'Emphasized text'],
  small: ['Teks kecil / catatan samping', 'Side comment or fine print'],
  mark: ['Teks tersorot (highlight)', 'Highlighted text'],
  time: ['Tanggal atau waktu terstruktur mesin', 'Machine-readable date/time'],
  abbr: ['Singkatan atau akronim dengan title', 'Abbreviation or acronym'],
  address: ['Informasi kontak penulis/pemilik', 'Contact information'],
  cite: ['Judul karya rujukan', 'Title of a cited work'],
  q: ['Kutipan pendek inline', 'Short inline quotation'],
  del: ['Teks yang dihapus (coret)', 'Deleted text'],
  ins: ['Teks yang ditambahkan (garis bawah)', 'Inserted text'],
  sub: ['Teks subskrip (bawah)', 'Subscript text'],
  sup: ['Teks superskrip (atas)', 'Superscript text'],
  kbd: ['Input tombol papan ketik', 'Keyboard input'],
  samp: ['Contoh output program', 'Sample program output'],
  var: ['Nama variabel matematis/program', 'Variable name'],
  b: ['Teks tebal gaya visual', 'Bring-attention bold text'],
  i: ['Teks miring idiomatis/ikon', 'Idiomatic italic text'],
  u: ['Teks bergaris bawah anotasi', 'Unarticulated annotation'],
  s: ['Teks tidak lagi relevan (coret)', 'Strikethrough text'],
  br: ['Pemisah baris baru (void)', 'Line break (void)'],
  hr: ['Garis pemisah tematik horizontal (void)', 'Thematic horizontal rule (void)'],
  wbr: ['Titik potong kata opsional (void)', 'Optional word break opportunity (void)'],
  ul: ['Daftar tak berurut (bullet)', 'Unordered bullet list'],
  ol: ['Daftar bernomor berurut', 'Ordered numbered list'],
  li: ['Item daftar di dalam <ul>/<ol>', 'List item'],
  dl: ['Daftar deskripsi istilah-definisi', 'Description list'],
  dt: ['Istilah pada daftar deskripsi', 'Description term'],
  dd: ['Penjelasan istilah pada daftar deskripsi', 'Description details'],
  table: ['Tabel data terstruktur HTML', 'Structured data table'],
  caption: ['Judul tabel', 'Table caption'],
  thead: ['Kelompok baris header tabel', 'Table header group'],
  tbody: ['Kelompok baris isi tabel', 'Table body group'],
  tfoot: ['Kelompok baris kaki tabel', 'Table footer group'],
  colgroup: ['Kelompok kolom tabel', 'Table column group'],
  col: ['Properti satu kolom tabel (void)', 'Table column (void)'],
  tr: ['Baris tabel', 'Table row'],
  th: ['Sel header tabel', 'Table header cell'],
  td: ['Sel data tabel', 'Table data cell'],
  form: ['Formulir input HTML interaktif', 'Interactive HTML form'],
  label: ['Label keterangan kontrol formulir', 'Form control label'],
  input: ['Kolom masukan data formulir (void)', 'Form input field (void)'],
  textarea: ['Kolom input teks multibaris', 'Multi-line text input'],
  select: ['Daftar pilihan dropdown', 'Dropdown select control'],
  optgroup: ['Kelompok opsi dalam <select>', 'Option group inside <select>'],
  option: ['Satu pilihan pada <select>/<datalist>', 'Option inside <select>/<datalist>'],
  datalist: ['Daftar saran otomatis untuk <input>', 'Autocomplete option list for <input>'],
  button: ['Tombol aksi interaktif', 'Interactive button element'],
  fieldset: ['Kelompok field terkait dalam formulir', 'Group of related form controls'],
  legend: ['Judul kelompok <fieldset>', 'Caption for a <fieldset>'],
  output: ['Hasil perhitungan atau aksi formulir', 'Calculation or action output'],
  progress: ['Indikator progres tugas', 'Task completion progress bar'],
  meter: ['Pengukur nilai skalar dalam rentang', 'Scalar measurement within a range'],
  details: ['Panel lipat interaktif (accordion)', 'Interactive disclosure widget'],
  summary: ['Judul ringkasan yang diklik pada <details>', 'Clickable heading for <details>'],
  dialog: ['Jendela dialog/modal bawaan HTML5', 'Native HTML5 dialog/modal'],
  video: ['Pemutar media video HTML5', 'HTML5 video player'],
  audio: ['Pemutar media audio HTML5', 'HTML5 audio player'],
  source: ['Sumber media alternatif (void)', 'Media source resource (void)'],
  track: ['Subtitle/teks media video/audio (void)', 'Media text track/captions (void)'],
  canvas: ['Area gambar grafis 2D/WebGL', '2D/WebGL drawing canvas'],
  svg: ['Grafis vektor SVG inline', 'Inline SVG vector graphic'],
  iframe: ['Bingkai penyematan halaman web lain', 'Inline nested browsing frame'],
  embed: ['Konten eksternal tersemat (void)', 'External embedded content (void)'],
  object: ['Objek sumber daya eksternal', 'External resource object'],
  template: ['Fragmen HTML yang tidak dirender langsung', 'Inert HTML template fragment'],
  slot: ['Slot proyeksi konten Web Component', 'Web Component content slot'],
}

/** JSX / React attributes and event handlers for `.jsx` / `.tsx` files. */
export const JSX_REACT_ATTR_SPECS: ReadonlyArray<{
  label: string
  insertText: string
  detailId: string
  detailEn: string
}> = [
  { label: 'className', insertText: 'className="$0"', detailId: 'Atribut kelas CSS pada React JSX', detailEn: 'CSS class attribute in React JSX' },
  { label: 'id', insertText: 'id="$0"', detailId: 'Identitas unik elemen', detailEn: 'Unique element identifier' },
  { label: 'style', insertText: 'style={{ $0 }}', detailId: 'Objek gaya CSS inline React', detailEn: 'React inline style object' },
  { label: 'key', insertText: 'key={$0}', detailId: 'Kunci unik daftar item React', detailEn: 'Unique React list reconciliation key' },
  { label: 'ref', insertText: 'ref={$0}', detailId: 'Referensi node DOM atau komponen React', detailEn: 'DOM or component ref handle' },
  { label: 'htmlFor', insertText: 'htmlFor="$0"', detailId: 'Pengganti atribut for pada <label> JSX', detailEn: 'React equivalent of HTML for attribute' },
  { label: 'onClick', insertText: 'onClick={() => $0}', detailId: 'Handler klik React', detailEn: 'React click event handler' },
  { label: 'onChange', insertText: 'onChange={(e) => $0}', detailId: 'Handler perubahan nilai input React', detailEn: 'React change event handler' },
  { label: 'onInput', insertText: 'onInput={(e) => $0}', detailId: 'Handler masukan langsung React', detailEn: 'React input event handler' },
  { label: 'onSubmit', insertText: 'onSubmit={(e) => {\n  e.preventDefault();\n  $0\n}}', detailId: 'Handler kirim formulir React', detailEn: 'React form submit event handler' },
  { label: 'onKeyDown', insertText: 'onKeyDown={(e) => $0}', detailId: 'Handler tombol keyboard ditekan', detailEn: 'React keydown event handler' },
  { label: 'onKeyUp', insertText: 'onKeyUp={(e) => $0}', detailId: 'Handler tombol keyboard dilepas', detailEn: 'React keyup event handler' },
  { label: 'onFocus', insertText: 'onFocus={(e) => $0}', detailId: 'Handler saat elemen fokus', detailEn: 'React focus event handler' },
  { label: 'onBlur', insertText: 'onBlur={(e) => $0}', detailId: 'Handler saat elemen kehilangan fokus', detailEn: 'React blur event handler' },
  { label: 'onMouseEnter', insertText: 'onMouseEnter={() => $0}', detailId: 'Handler saat pointer masuk elemen', detailEn: 'React mouse enter handler' },
  { label: 'onMouseLeave', insertText: 'onMouseLeave={() => $0}', detailId: 'Handler saat pointer keluar elemen', detailEn: 'React mouse leave handler' },
  { label: 'onPointerDown', insertText: 'onPointerDown={(e) => $0}', detailId: 'Handler pointer ditekan', detailEn: 'React pointer down handler' },
  { label: 'onScroll', insertText: 'onScroll={(e) => $0}', detailId: 'Handler gulir halaman/wadah', detailEn: 'React scroll event handler' },
  { label: 'type', insertText: 'type="$0"', detailId: 'Tipe tombol atau input', detailEn: 'Button or input type' },
  { label: 'value', insertText: 'value={$0}', detailId: 'Nilai terkontrol komponen input', detailEn: 'Controlled input value' },
  { label: 'defaultValue', insertText: 'defaultValue="$0"', detailId: 'Nilai awal input tidak terkontrol', detailEn: 'Uncontrolled initial input value' },
  { label: 'checked', insertText: 'checked={$0}', detailId: 'Status centang checkbox/radio', detailEn: 'Controlled checked state' },
  { label: 'defaultChecked', insertText: 'defaultChecked={$0}', detailId: 'Status centang awal', detailEn: 'Uncontrolled initial checked state' },
  { label: 'placeholder', insertText: 'placeholder="$0"', detailId: 'Teks petunjuk di dalam input', detailEn: 'Input placeholder hint' },
  { label: 'name', insertText: 'name="$0"', detailId: 'Nama field formulir', detailEn: 'Form field name' },
  { label: 'disabled', insertText: 'disabled={$0}', detailId: 'Nonaktifkan elemen interaktif', detailEn: 'Disable interactive control' },
  { label: 'required', insertText: 'required', detailId: 'Wajib diisi pada formulir', detailEn: 'Required form field' },
  { label: 'readOnly', insertText: 'readOnly', detailId: 'Field hanya-baca', detailEn: 'Read-only form field' },
  { label: 'autoFocus', insertText: 'autoFocus', detailId: 'Fokus otomatis saat elemen dipasang', detailEn: 'Auto-focus on mount' },
  { label: 'autoComplete', insertText: 'autoComplete="$0"', detailId: 'Petunjuk autofill browser', detailEn: 'Browser autofill hint' },
  { label: 'href', insertText: 'href="$0"', detailId: 'URL tujuan tautan', detailEn: 'Link target URL' },
  { label: 'target', insertText: 'target="$0"', detailId: 'Target jendela tautan', detailEn: 'Link target window' },
  { label: 'rel', insertText: 'rel="$0"', detailId: 'Relasi tautan (noopener noreferrer)', detailEn: 'Link relationship' },
  { label: 'src', insertText: 'src="$0"', detailId: 'Sumber URL gambar/media', detailEn: 'Media source URL' },
  { label: 'alt', insertText: 'alt="$0"', detailId: 'Teks alternatif gambar', detailEn: 'Image alternative text' },
  { label: 'width', insertText: 'width={$0}', detailId: 'Lebar elemen media', detailEn: 'Element width' },
  { label: 'height', insertText: 'height={$0}', detailId: 'Tinggi elemen media', detailEn: 'Element height' },
  { label: 'title', insertText: 'title="$0"', detailId: 'Tooltip teks saat hover', detailEn: 'Hover tooltip text' },
  { label: 'role', insertText: 'role="$0"', detailId: 'Peran aksesibilitas ARIA', detailEn: 'ARIA accessibility role' },
  { label: 'tabIndex', insertText: 'tabIndex={$0}', detailId: 'Urutan fokus tombol Tab', detailEn: 'Keyboard tab focus order' },
  { label: 'hidden', insertText: 'hidden', detailId: 'Sembunyikan elemen dari tampilan', detailEn: 'Hide element' },
  { label: 'aria-label', insertText: 'aria-label="$0"', detailId: 'Label aksesibilitas screen reader', detailEn: 'Screen reader accessible label' },
  { label: 'aria-hidden', insertText: 'aria-hidden="$0"', detailId: 'Sembunyikan dari teknologi bantu', detailEn: 'Hide from assistive tech' },
  { label: 'aria-expanded', insertText: 'aria-expanded={$0}', detailId: 'Status terbuka/tertutup kontrol', detailEn: 'Expanded/collapsed state' },
  { label: 'aria-selected', insertText: 'aria-selected={$0}', detailId: 'Status item terpilih', detailEn: 'Selected state' },
  { label: 'aria-controls', insertText: 'aria-controls="$0"', detailId: 'ID elemen yang dikendalikan', detailEn: 'Controlled element ID' },
  { label: 'aria-live', insertText: 'aria-live="$0"', detailId: 'Wilayah pengumuman dinamis ARIA', detailEn: 'ARIA live announcement region' },
  { label: 'data-testid', insertText: 'data-testid="$0"', detailId: 'Atribut selector pengujian otomatis', detailEn: 'Automated testing attribute' },
  { label: 'data-', insertText: 'data-$0=""', detailId: 'Atribut data kustom HTML5', detailEn: 'Custom HTML5 data attribute' },
  { label: 'colSpan', insertText: 'colSpan={$0}', detailId: 'Rentang kolom sel tabel', detailEn: 'Table cell column span' },
  { label: 'rowSpan', insertText: 'rowSpan={$0}', detailId: 'Rentang baris sel tabel', detailEn: 'Table cell row span' },
  { label: 'dangerouslySetInnerHTML', insertText: 'dangerouslySetInnerHTML={{ __html: $0 }}', detailId: 'Sisipkan HTML mentah (gunakan hati-hati)', detailEn: 'Inject raw HTML string' },
]

/** Modern CSS3/4 properties supplementing `document.body.style` (logical, container, scroll, view transitions, etc.). */
export const CSS_MODERN_PROPERTIES: readonly string[] = [
  'accent-color', 'align-content', 'align-items', 'align-self', 'all', 'anchor-name',
  'animation', 'animation-composition', 'animation-delay', 'animation-direction',
  'animation-duration', 'animation-fill-mode', 'animation-iteration-count', 'animation-name',
  'animation-play-state', 'animation-range', 'animation-timeline', 'animation-timing-function',
  'appearance', 'aspect-ratio', 'backdrop-filter', 'backface-visibility', 'background',
  'background-attachment', 'background-blend-mode', 'background-clip', 'background-color',
  'background-image', 'background-origin', 'background-position', 'background-repeat', 'background-size',
  'block-size', 'border', 'border-block', 'border-block-color', 'border-block-end', 'border-block-start',
  'border-bottom', 'border-bottom-color', 'border-bottom-left-radius', 'border-bottom-right-radius',
  'border-bottom-style', 'border-bottom-width', 'border-collapse', 'border-color', 'border-image',
  'border-inline', 'border-inline-color', 'border-inline-end', 'border-inline-start',
  'border-left', 'border-radius', 'border-right', 'border-spacing', 'border-style',
  'border-top', 'border-top-left-radius', 'border-top-right-radius', 'border-width',
  'bottom', 'box-decoration-break', 'box-shadow', 'box-sizing', 'break-after', 'break-before', 'break-inside',
  'caption-side', 'caret-color', 'clear', 'clip-path', 'color', 'color-scheme',
  'column-count', 'column-fill', 'column-gap', 'column-rule', 'column-span', 'column-width', 'columns',
  'contain', 'contain-intrinsic-size', 'container', 'container-name', 'container-type',
  'content', 'content-visibility', 'counter-increment', 'counter-reset', 'counter-set', 'cursor',
  'direction', 'display', 'empty-cells', 'field-sizing', 'fill', 'filter',
  'flex', 'flex-basis', 'flex-direction', 'flex-flow', 'flex-grow', 'flex-shrink', 'flex-wrap', 'float',
  'font', 'font-family', 'font-feature-settings', 'font-kerning', 'font-optical-sizing', 'font-palette',
  'font-size', 'font-size-adjust', 'font-stretch', 'font-style', 'font-synthesis',
  'font-variant', 'font-variant-caps', 'font-variant-numeric', 'font-variation-settings', 'font-weight',
  'forced-color-adjust', 'gap', 'grid', 'grid-area', 'grid-auto-columns', 'grid-auto-flow', 'grid-auto-rows',
  'grid-column', 'grid-column-end', 'grid-column-start', 'grid-row', 'grid-row-end', 'grid-row-start',
  'grid-template', 'grid-template-areas', 'grid-template-columns', 'grid-template-rows',
  'height', 'hyphenate-character', 'hyphens', 'image-rendering', 'inline-size',
  'inset', 'inset-block', 'inset-block-end', 'inset-block-start', 'inset-inline', 'inset-inline-end', 'inset-inline-start',
  'interpolate-size', 'isolation', 'justify-content', 'justify-items', 'justify-self',
  'left', 'letter-spacing', 'line-break', 'line-clamp', 'line-height',
  'list-style', 'list-style-image', 'list-style-position', 'list-style-type',
  'margin', 'margin-block', 'margin-block-end', 'margin-block-start', 'margin-bottom',
  'margin-inline', 'margin-inline-end', 'margin-inline-start', 'margin-left', 'margin-right', 'margin-top',
  'mask', 'mask-clip', 'mask-composite', 'mask-image', 'mask-mode', 'mask-origin', 'mask-position', 'mask-repeat', 'mask-size',
  'max-block-size', 'max-height', 'max-inline-size', 'max-width',
  'min-block-size', 'min-height', 'min-inline-size', 'min-width', 'mix-blend-mode',
  'object-fit', 'object-position', 'offset', 'offset-path', 'offset-distance', 'offset-rotate',
  'opacity', 'order', 'orphans', 'outline', 'outline-color', 'outline-offset', 'outline-style', 'outline-width',
  'overflow', 'overflow-anchor', 'overflow-block', 'overflow-clip-margin', 'overflow-inline', 'overflow-wrap', 'overflow-x', 'overflow-y',
  'overlay', 'overscroll-behavior', 'overscroll-behavior-x', 'overscroll-behavior-y',
  'padding', 'padding-block', 'padding-block-end', 'padding-block-start', 'padding-bottom',
  'padding-inline', 'padding-inline-end', 'padding-inline-start', 'padding-left', 'padding-right', 'padding-top',
  'page-break-after', 'page-break-before', 'page-break-inside', 'paint-order',
  'perspective', 'perspective-origin', 'place-content', 'place-items', 'place-self', 'pointer-events',
  'position', 'position-anchor', 'position-area', 'position-try-fallbacks', 'print-color-adjust',
  'quotes', 'resize', 'right', 'rotate', 'row-gap', 'scale',
  'scroll-behavior', 'scroll-margin', 'scroll-margin-bottom', 'scroll-margin-left', 'scroll-margin-right', 'scroll-margin-top',
  'scroll-padding', 'scroll-padding-bottom', 'scroll-padding-left', 'scroll-padding-right', 'scroll-padding-top',
  'scroll-snap-align', 'scroll-snap-stop', 'scroll-snap-type', 'scroll-timeline',
  'scrollbar-color', 'scrollbar-gutter', 'scrollbar-width', 'shape-outside', 'stroke', 'stroke-width',
  'tab-size', 'table-layout', 'text-align', 'text-align-last', 'text-box', 'text-decoration',
  'text-decoration-color', 'text-decoration-line', 'text-decoration-skip-ink', 'text-decoration-style',
  'text-decoration-thickness', 'text-emphasis', 'text-indent', 'text-orientation', 'text-overflow',
  'text-rendering', 'text-shadow', 'text-transform', 'text-underline-offset', 'text-wrap',
  'top', 'touch-action', 'transform', 'transform-box', 'transform-origin', 'transform-style',
  'transition', 'transition-behavior', 'transition-delay', 'transition-duration', 'transition-property', 'transition-timing-function',
  'translate', 'unicode-bidi', 'user-select', 'vertical-align', 'view-timeline', 'view-transition-name',
  'visibility', 'white-space', 'widows', 'width', 'will-change', 'word-break', 'word-spacing', 'writing-mode', 'z-index', 'zoom',
]

/** Property-specific prioritized value completions (like VS Code CSS language service). */
export const CSS_PROPERTY_VALUES: Record<string, readonly string[]> = {
  display: [
    'flex', 'grid', 'block', 'inline-block', 'inline', 'inline-flex', 'inline-grid',
    'none', 'contents', 'flow-root', 'table', 'table-row', 'table-cell', 'list-item',
  ],
  position: ['relative', 'absolute', 'fixed', 'sticky', 'static'],
  'flex-direction': ['row', 'column', 'row-reverse', 'column-reverse'],
  'flex-wrap': ['wrap', 'nowrap', 'wrap-reverse'],
  'justify-content': [
    'center', 'space-between', 'space-around', 'space-evenly',
    'flex-start', 'flex-end', 'start', 'end', 'stretch', 'normal',
  ],
  'justify-items': ['center', 'start', 'end', 'stretch', 'baseline'],
  'justify-self': ['auto', 'center', 'start', 'end', 'stretch'],
  'align-items': ['center', 'stretch', 'flex-start', 'flex-end', 'start', 'end', 'baseline'],
  'align-content': ['center', 'space-between', 'space-around', 'space-evenly', 'stretch', 'flex-start', 'flex-end'],
  'align-self': ['auto', 'center', 'stretch', 'flex-start', 'flex-end', 'baseline'],
  'place-items': ['center', 'start', 'end', 'stretch', 'baseline'],
  'place-content': ['center', 'space-between', 'space-around', 'space-evenly', 'stretch'],
  'place-self': ['auto', 'center', 'start', 'end', 'stretch'],
  'grid-auto-flow': ['row', 'column', 'dense', 'row dense', 'column dense'],
  'box-sizing': ['border-box', 'content-box'],
  overflow: ['hidden', 'auto', 'scroll', 'visible', 'clip'],
  'overflow-x': ['hidden', 'auto', 'scroll', 'visible', 'clip'],
  'overflow-y': ['hidden', 'auto', 'scroll', 'visible', 'clip'],
  'overscroll-behavior': ['auto', 'contain', 'none'],
  'text-align': ['left', 'center', 'right', 'justify', 'start', 'end'],
  'text-transform': ['none', 'uppercase', 'lowercase', 'capitalize'],
  'text-decoration': ['none', 'underline', 'line-through', 'overline'],
  'text-decoration-style': ['solid', 'double', 'dotted', 'dashed', 'wavy'],
  'text-overflow': ['ellipsis', 'clip'],
  'text-wrap': ['wrap', 'nowrap', 'balance', 'pretty', 'stable'],
  'white-space': ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line', 'break-spaces'],
  'word-break': ['normal', 'break-all', 'keep-all', 'break-word'],
  'overflow-wrap': ['normal', 'break-word', 'anywhere'],
  'font-weight': ['400', '500', '600', '700', '800', '900', 'normal', 'bold', 'bolder', 'lighter'],
  'font-style': ['normal', 'italic', 'oblique'],
  'font-variant-numeric': ['normal', 'tabular-nums', 'lining-nums', 'oldstyle-nums', 'slashed-zero'],
  cursor: [
    'pointer', 'default', 'not-allowed', 'text', 'move', 'grab', 'grabbing',
    'wait', 'progress', 'crosshair', 'help', 'col-resize', 'row-resize', 'zoom-in', 'zoom-out', 'none',
  ],
  'pointer-events': ['auto', 'none'],
  'user-select': ['none', 'auto', 'text', 'all', 'contain'],
  visibility: ['visible', 'hidden', 'collapse'],
  'object-fit': ['cover', 'contain', 'fill', 'none', 'scale-down'],
  'object-position': ['center', 'top', 'bottom', 'left', 'right'],
  'background-size': ['cover', 'contain', 'auto'],
  'background-repeat': ['no-repeat', 'repeat', 'repeat-x', 'repeat-y', 'space', 'round'],
  'background-position': ['center', 'top', 'bottom', 'left', 'right'],
  'background-attachment': ['scroll', 'fixed', 'local'],
  'background-clip': ['border-box', 'padding-box', 'content-box', 'text'],
  'border-style': ['solid', 'dashed', 'dotted', 'double', 'none', 'groove', 'ridge', 'inset', 'outset'],
  'border-collapse': ['collapse', 'separate'],
  'outline-style': ['solid', 'dashed', 'dotted', 'double', 'none', 'auto'],
  'list-style': ['none', 'disc', 'circle', 'square', 'decimal'],
  'list-style-type': ['none', 'disc', 'circle', 'square', 'decimal', 'lower-alpha', 'upper-alpha', 'lower-roman'],
  'list-style-position': ['inside', 'outside'],
  'scroll-behavior': ['smooth', 'auto'],
  'scroll-snap-type': ['none', 'x mandatory', 'y mandatory', 'x proximity', 'y proximity', 'both mandatory'],
  'scroll-snap-align': ['start', 'center', 'end', 'none'],
  'scrollbar-width': ['auto', 'thin', 'none'],
  'scrollbar-gutter': ['auto', 'stable', 'stable both-edges'],
  'color-scheme': ['light dark', 'dark light', 'light', 'dark', 'only light', 'only dark'],
  'container-type': ['inline-size', 'size', 'normal'],
  'content-visibility': ['visible', 'auto', 'hidden'],
  isolation: ['isolate', 'auto'],
  contain: ['none', 'strict', 'content', 'size', 'inline-size', 'layout', 'style', 'paint'],
  'mix-blend-mode': ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion'],
  'transition-timing-function': ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'step-start', 'step-end'],
  'transition-behavior': ['normal', 'allow-discrete'],
  'animation-fill-mode': ['none', 'forwards', 'backwards', 'both'],
  'animation-direction': ['normal', 'reverse', 'alternate', 'alternate-reverse'],
  'animation-play-state': ['running', 'paused'],
  'animation-iteration-count': ['infinite', '1', '2'],
  'transform-style': ['flat', 'preserve-3d'],
  'backface-visibility': ['visible', 'hidden'],
  resize: ['none', 'both', 'horizontal', 'vertical', 'block', 'inline'],
  float: ['none', 'left', 'right', 'inline-start', 'inline-end'],
  clear: ['none', 'left', 'right', 'both'],
  'vertical-align': ['baseline', 'middle', 'top', 'bottom', 'text-top', 'text-bottom', 'sub', 'super'],
  'table-layout': ['auto', 'fixed'],
  appearance: ['none', 'auto'],
  'writing-mode': ['horizontal-tb', 'vertical-rl', 'vertical-lr'],
  direction: ['ltr', 'rtl'],
  hyphens: ['none', 'manual', 'auto'],
  'field-sizing': ['content', 'fixed'],
  'interpolate-size': ['allow-keywords', 'numeric-only'],
  'touch-action': ['auto', 'none', 'pan-x', 'pan-y', 'manipulation', 'pinch-zoom'],
}

/** Modern CSS functions available in declaration value context. */
export const CSS_FUNCTIONS: ReadonlyArray<{ label: string; insertText: string; detail: string }> = [
  { label: 'var()', insertText: 'var(--$0)', detail: 'CSS custom property' },
  { label: 'calc()', insertText: 'calc($0)', detail: 'CSS math calculation' },
  { label: 'clamp()', insertText: 'clamp($0)', detail: 'Clamp(min, preferred, max)' },
  { label: 'min()', insertText: 'min($0)', detail: 'Minimum CSS value' },
  { label: 'max()', insertText: 'max($0)', detail: 'Maximum CSS value' },
  { label: 'minmax()', insertText: 'minmax($0, 1fr)', detail: 'CSS Grid track min/max size' },
  { label: 'repeat()', insertText: 'repeat($0, 1fr)', detail: 'CSS Grid repeated tracks' },
  { label: 'fit-content()', insertText: 'fit-content($0)', detail: 'Fit content up to max size' },
  { label: 'rgb()', insertText: 'rgb($0)', detail: 'RGB color function' },
  { label: 'rgba()', insertText: 'rgba($0, 0.5)', detail: 'RGBA color with alpha' },
  { label: 'hsl()', insertText: 'hsl($0)', detail: 'HSL color function' },
  { label: 'oklch()', insertText: 'oklch($0)', detail: 'Perceptually uniform OKLCH color' },
  { label: 'oklab()', insertText: 'oklab($0)', detail: 'Perceptually uniform OKLab color' },
  { label: 'color-mix()', insertText: 'color-mix(in oklch, $0)', detail: 'Mix two CSS colors' },
  { label: 'light-dark()', insertText: 'light-dark($0, )', detail: 'Theme-adaptive color value' },
  { label: 'linear-gradient()', insertText: 'linear-gradient(135deg, $0)', detail: 'Linear color gradient' },
  { label: 'radial-gradient()', insertText: 'radial-gradient(circle, $0)', detail: 'Radial color gradient' },
  { label: 'conic-gradient()', insertText: 'conic-gradient($0)', detail: 'Conic color gradient' },
  { label: 'cubic-bezier()', insertText: 'cubic-bezier($0)', detail: 'Custom easing curve' },
  { label: 'steps()', insertText: 'steps($0)', detail: 'Stepped timing function' },
  { label: 'translate()', insertText: 'translate($0)', detail: '2D translation transform' },
  { label: 'translateX()', insertText: 'translateX($0)', detail: 'Horizontal translation' },
  { label: 'translateY()', insertText: 'translateY($0)', detail: 'Vertical translation' },
  { label: 'scale()', insertText: 'scale($0)', detail: '2D scale transform' },
  { label: 'rotate()', insertText: 'rotate($0deg)', detail: '2D rotation transform' },
  { label: 'skew()', insertText: 'skew($0deg)', detail: '2D skew transform' },
  { label: 'blur()', insertText: 'blur($0px)', detail: 'Gaussian blur filter' },
  { label: 'brightness()', insertText: 'brightness($0)', detail: 'Brightness filter' },
  { label: 'contrast()', insertText: 'contrast($0)', detail: 'Contrast filter' },
  { label: 'drop-shadow()', insertText: 'drop-shadow($0)', detail: 'Drop shadow filter' },
  { label: 'grayscale()', insertText: 'grayscale($0)', detail: 'Grayscale filter' },
  { label: 'saturate()', insertText: 'saturate($0)', detail: 'Saturation filter' },
  { label: 'url()', insertText: 'url("$0")', detail: 'External resource URL' },
  { label: 'env()', insertText: 'env($0)', detail: 'Environment variable (safe-area-inset)' },
  { label: 'attr()', insertText: 'attr($0)', detail: 'HTML attribute value' },
  { label: 'polygon()', insertText: 'polygon($0)', detail: 'Clip-path polygon shape' },
  { label: 'circle()', insertText: 'circle($0)', detail: 'Clip-path circle shape' },
  { label: 'inset()', insertText: 'inset($0)', detail: 'Clip-path inset rectangle' },
]

/** Modern CSS pseudo-classes and pseudo-elements supplementing `@codemirror/lang-css`. */
export const CSS_EXTRA_PSEUDOS: readonly string[] = [
  'hover', 'focus', 'focus-visible', 'focus-within', 'active', 'visited', 'link', 'any-link',
  'target', 'checked', 'indeterminate', 'disabled', 'enabled', 'read-only', 'read-write',
  'required', 'optional', 'valid', 'invalid', 'user-valid', 'user-invalid',
  'in-range', 'out-of-range', 'placeholder-shown', 'autofill', 'empty', 'root',
  'first-child', 'last-child', 'only-child', 'nth-child()', 'nth-last-child()',
  'first-of-type', 'last-of-type', 'only-of-type', 'nth-of-type()', 'nth-last-of-type()',
  'not()', 'is()', 'where()', 'has()', 'lang()', 'dir()',
  'fullscreen', 'modal', 'popover-open', 'open', 'scope', 'defined', 'host',
  'before', 'after', 'placeholder', 'selection', 'marker', 'backdrop',
  'first-line', 'first-letter', 'file-selector-button', 'part()', 'slotted()',
  'view-transition', 'view-transition-old()', 'view-transition-new()', 'details-content',
]

export const CSS_GLOBAL_KEYWORDS: readonly string[] = [
  'inherit', 'initial', 'unset', 'revert', 'revert-layer', 'auto', 'none', 'currentColor', 'transparent',
  'min-content', 'max-content', 'fit-content',
]

/** Missing JS / TS keywords not included in `@codemirror/lang-javascript`'s built-in keyword list. */
export const JS_EXTRA_KEYWORDS: readonly string[] = [
  'async', 'await', 'catch', 'debugger', 'else', 'from', 'of', 'null', 'undefined',
  'void', 'with', 'get', 'set', 'using', 'globalThis', 'NaN', 'Infinity',
]

export const TS_EXTRA_KEYWORDS: readonly string[] = [
  'abstract', 'any', 'as', 'asserts', 'bigint', 'boolean', 'infer', 'is', 'keyof',
  'module', 'namespace', 'never', 'number', 'object', 'override', 'readonly',
  'satisfies', 'string', 'symbol', 'unique', 'unknown',
  'Record', 'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Exclude', 'Extract',
  'NonNullable', 'ReturnType', 'Parameters', 'InstanceType', 'Awaited', 'Promise',
]

export interface JsApiInfo {
  label: string
  kind: 'function' | 'class' | 'variable' | 'constant' | 'method' | 'property'
  insertText?: string
  detailId: string
  detailEn: string
}

/** Standard ECMAScript + Browser Web / DOM globals (always available in JS/TS/JSX/TSX). */
export const JS_STANDARD_GLOBALS: readonly JsApiInfo[] = [
  // Browser & DOM globals
  { label: 'document', kind: 'variable', detailId: 'Objek DOM dokumen HTML aktif', detailEn: 'Active HTML Document DOM object' },
  { label: 'window', kind: 'variable', detailId: 'Objek global jendela browser', detailEn: 'Global browser Window object' },
  { label: 'console', kind: 'variable', detailId: 'Konsol logging & debugging browser', detailEn: 'Browser debugging console' },
  { label: 'navigator', kind: 'variable', detailId: 'Info browser, clipboard, geolocation', detailEn: 'Browser capabilities & user agent' },
  { label: 'location', kind: 'variable', detailId: 'URL halaman saat ini & navigasi', detailEn: 'Current URL and navigation' },
  { label: 'history', kind: 'variable', detailId: 'Riwayat navigasi sesi browser', detailEn: 'Browser session history API' },
  { label: 'screen', kind: 'variable', detailId: 'Dimensi dan orientasi layar', detailEn: 'Screen dimensions & orientation' },
  { label: 'localStorage', kind: 'variable', detailId: 'Penyimpanan key-value permanen browser', detailEn: 'Persistent browser key-value storage' },
  { label: 'sessionStorage', kind: 'variable', detailId: 'Penyimpanan key-value sementara per tab', detailEn: 'Per-tab session key-value storage' },
  { label: 'crypto', kind: 'variable', detailId: 'Web Crypto API (randomUUID, subtle)', detailEn: 'Web Crypto API (randomUUID, subtle)' },
  { label: 'performance', kind: 'variable', detailId: 'Pengukuran waktu & performa tinggi', detailEn: 'High-resolution performance timing API' },
  { label: 'CSS', kind: 'variable', detailId: 'Utilitas CSSOM (CSS.supports, CSS.escape)', detailEn: 'CSSOM utilities (CSS.supports, CSS.escape)' },
  // Web global functions
  { label: 'fetch', kind: 'function', insertText: 'fetch("$0")', detailId: 'Kirim permintaan HTTP asinkron', detailEn: 'Send asynchronous HTTP request' },
  { label: 'setTimeout', kind: 'function', insertText: 'setTimeout(() => {\n  $0\n}, 1000)', detailId: 'Jalankan fungsi setelah jeda ms', detailEn: 'Run callback after delay in ms' },
  { label: 'clearTimeout', kind: 'function', insertText: 'clearTimeout($0)', detailId: 'Batalkan timer setTimeout', detailEn: 'Cancel a setTimeout timer' },
  { label: 'setInterval', kind: 'function', insertText: 'setInterval(() => {\n  $0\n}, 1000)', detailId: 'Jalankan fungsi berulang tiap interval ms', detailEn: 'Run callback repeatedly every interval' },
  { label: 'clearInterval', kind: 'function', insertText: 'clearInterval($0)', detailId: 'Hentikan timer setInterval', detailEn: 'Cancel a setInterval timer' },
  { label: 'requestAnimationFrame', kind: 'function', insertText: 'requestAnimationFrame(() => {\n  $0\n})', detailId: 'Jadwalkan frame animasi browser', detailEn: 'Schedule next repaint frame' },
  { label: 'cancelAnimationFrame', kind: 'function', insertText: 'cancelAnimationFrame($0)', detailId: 'Batalkan callback requestAnimationFrame', detailEn: 'Cancel scheduled animation frame' },
  { label: 'queueMicrotask', kind: 'function', insertText: 'queueMicrotask(() => {\n  $0\n})', detailId: 'Antrekan microtask asinkron', detailEn: 'Queue an async microtask' },
  { label: 'structuredClone', kind: 'function', insertText: 'structuredClone($0)', detailId: 'Salin mendalam (deep clone) nilai JS', detailEn: 'Deep-clone a structured value' },
  { label: 'getComputedStyle', kind: 'function', insertText: 'getComputedStyle($0)', detailId: 'Baca gaya CSS terhitung elemen DOM', detailEn: 'Read computed CSS styles of element' },
  { label: 'matchMedia', kind: 'function', insertText: 'matchMedia("($0)")', detailId: 'Evaluasi CSS media query via JS', detailEn: 'Evaluate CSS media query in JS' },
  { label: 'parseInt', kind: 'function', insertText: 'parseInt($0, 10)', detailId: 'Konversi string ke bilangan bulat', detailEn: 'Parse string to integer' },
  { label: 'parseFloat', kind: 'function', insertText: 'parseFloat($0)', detailId: 'Konversi string ke bilangan desimal', detailEn: 'Parse string to floating-point number' },
  { label: 'isNaN', kind: 'function', insertText: 'isNaN($0)', detailId: 'Periksa apakah nilai NaN', detailEn: 'Check if value is NaN' },
  { label: 'isFinite', kind: 'function', insertText: 'isFinite($0)', detailId: 'Periksa apakah angka berhingga', detailEn: 'Check if number is finite' },
  { label: 'encodeURIComponent', kind: 'function', insertText: 'encodeURIComponent($0)', detailId: 'Encode komponen query URL dengan aman', detailEn: 'Percent-encode URI component' },
  { label: 'decodeURIComponent', kind: 'function', insertText: 'decodeURIComponent($0)', detailId: 'Decode komponen query URL', detailEn: 'Decode percent-encoded URI component' },
  { label: 'encodeURI', kind: 'function', insertText: 'encodeURI($0)', detailId: 'Encode alamat URI utuh', detailEn: 'Encode full URI string' },
  { label: 'decodeURI', kind: 'function', insertText: 'decodeURI($0)', detailId: 'Decode alamat URI utuh', detailEn: 'Decode full URI string' },
  { label: 'atob', kind: 'function', insertText: 'atob($0)', detailId: 'Decode string Base64', detailEn: 'Decode Base64-encoded ASCII string' },
  { label: 'btoa', kind: 'function', insertText: 'btoa($0)', detailId: 'Encode string ke Base64', detailEn: 'Encode ASCII string to Base64' },
  { label: 'alert', kind: 'function', insertText: 'alert("$0")', detailId: 'Tampilkan kotak pesan browser', detailEn: 'Display browser alert dialog' },
  { label: 'confirm', kind: 'function', insertText: 'confirm("$0")', detailId: 'Tampilkan dialog konfirmasi OK/Batal', detailEn: 'Display confirmation dialog' },
  { label: 'prompt', kind: 'function', insertText: 'prompt("$0")', detailId: 'Tampilkan dialog input teks browser', detailEn: 'Display text prompt dialog' },
  // ECMAScript built-in objects & constructors
  { label: 'Math', kind: 'variable', detailId: 'Fungsi & konstanta matematika', detailEn: 'Math constants and functions' },
  { label: 'JSON', kind: 'variable', detailId: 'Parsing & serialisasi JSON', detailEn: 'JSON parse and stringify utilities' },
  { label: 'Reflect', kind: 'variable', detailId: 'Operasi meta-pemrograman objek', detailEn: 'Object reflection operations' },
  { label: 'Intl', kind: 'variable', detailId: 'Format angka, tanggal, dan bahasa (i18n)', detailEn: 'Internationalization formatting API' },
  { label: 'Object', kind: 'class', detailId: 'Konstruktor & utilitas Object ES6+', detailEn: 'JavaScript Object constructor & helpers' },
  { label: 'Array', kind: 'class', detailId: 'Konstruktor & utilitas Array', detailEn: 'JavaScript Array constructor & helpers' },
  { label: 'String', kind: 'class', detailId: 'Konstruktor & utilitas String', detailEn: 'JavaScript String constructor' },
  { label: 'Number', kind: 'class', detailId: 'Konstruktor & utilitas Number', detailEn: 'JavaScript Number constructor' },
  { label: 'Boolean', kind: 'class', detailId: 'Konstruktor Boolean', detailEn: 'JavaScript Boolean constructor' },
  { label: 'BigInt', kind: 'class', detailId: 'Bilangan bulat presisi arbitrer', detailEn: 'Arbitrary-precision integer' },
  { label: 'Symbol', kind: 'class', detailId: 'Pengenal primitif unik Symbol', detailEn: 'Unique primitive Symbol' },
  { label: 'Date', kind: 'class', detailId: 'Tanggal & waktu JavaScript', detailEn: 'JavaScript Date & time class' },
  { label: 'RegExp', kind: 'class', detailId: 'Ekspresi reguler (regex)', detailEn: 'Regular expression class' },
  { label: 'Map', kind: 'class', detailId: 'Koleksi pasangan kunci-nilai terurut', detailEn: 'Ordered key-value Map collection' },
  { label: 'Set', kind: 'class', detailId: 'Koleksi nilai unik Set', detailEn: 'Unique-value Set collection' },
  { label: 'WeakMap', kind: 'class', detailId: 'Map dengan referensi lemah kunci objek', detailEn: 'Weakly-referenced object key Map' },
  { label: 'WeakSet', kind: 'class', detailId: 'Set dengan referensi lemah objek', detailEn: 'Weakly-referenced object Set' },
  { label: 'Promise', kind: 'class', detailId: 'Representasi operasi asinkron', detailEn: 'Asynchronous computation Promise' },
  { label: 'Proxy', kind: 'class', detailId: 'Intersepsi operasi objek kustom', detailEn: 'Object operation trap Proxy' },
  { label: 'Error', kind: 'class', detailId: 'Objek kesalahan standar JS', detailEn: 'Standard JavaScript Error' },
  { label: 'TypeError', kind: 'class', detailId: 'Kesalahan tipe nilai tidak sesuai', detailEn: 'Invalid type Error' },
  { label: 'RangeError', kind: 'class', detailId: 'Kesalahan nilai di luar rentang', detailEn: 'Out-of-range Error' },
  { label: 'SyntaxError', kind: 'class', detailId: 'Kesalahan sintaks kode/JSON', detailEn: 'Syntax parsing Error' },
  { label: 'URL', kind: 'class', detailId: 'Parser & pembuat alamat URL', detailEn: 'URL parser and builder' },
  { label: 'URLSearchParams', kind: 'class', detailId: 'Manipulasi query string URL', detailEn: 'URL query parameters API' },
  { label: 'Headers', kind: 'class', detailId: 'Header HTTP untuk Fetch API', detailEn: 'HTTP Headers for Fetch API' },
  { label: 'Request', kind: 'class', detailId: 'Objek permintaan HTTP Fetch API', detailEn: 'Fetch API HTTP Request' },
  { label: 'Response', kind: 'class', detailId: 'Objek respons HTTP Fetch API', detailEn: 'Fetch API HTTP Response' },
  { label: 'FormData', kind: 'class', detailId: 'Pasangan field formulir & unggah file', detailEn: 'Multipart form fields & file uploads' },
  { label: 'Blob', kind: 'class', detailId: 'Data biner/file tak berubah', detailEn: 'Immutable raw binary data' },
  { label: 'File', kind: 'class', detailId: 'Objek file dari input/drag-drop', detailEn: 'File object with metadata' },
  { label: 'FileReader', kind: 'class', detailId: 'Membaca isi Blob/File secara asinkron', detailEn: 'Read Blob/File contents asynchronously' },
  { label: 'AbortController', kind: 'class', detailId: 'Membatalkan fetch atau operasi async', detailEn: 'Cancel fetch or async tasks' },
  { label: 'Event', kind: 'class', detailId: 'Objek event DOM standar', detailEn: 'Standard DOM Event' },
  { label: 'CustomEvent', kind: 'class', detailId: 'Event DOM kustom dengan detail payload', detailEn: 'Custom DOM Event with detail data' },
  { label: 'MutationObserver', kind: 'class', detailId: 'Pantau perubahan struktur pohon DOM', detailEn: 'Observe DOM tree mutations' },
  { label: 'IntersectionObserver', kind: 'class', detailId: 'Deteksi visibilitas elemen di viewport', detailEn: 'Observe element viewport visibility' },
  { label: 'ResizeObserver', kind: 'class', detailId: 'Pantau perubahan ukuran elemen DOM', detailEn: 'Observe element size changes' },
  { label: 'TextEncoder', kind: 'class', detailId: 'Encode string ke byte UTF-8', detailEn: 'Encode strings to UTF-8 bytes' },
  { label: 'TextDecoder', kind: 'class', detailId: 'Decode byte UTF-8 ke string', detailEn: 'Decode UTF-8 bytes to string' },
  { label: 'WebSocket', kind: 'class', detailId: 'Koneksi dua arah real-time WebSocket', detailEn: 'Full-duplex WebSocket connection' },
  { label: 'EventSource', kind: 'class', detailId: 'Klien Server-Sent Events (SSE)', detailEn: 'Server-Sent Events (SSE) client' },
  { label: 'BroadcastChannel', kind: 'class', detailId: 'Komunikasi antar tab dalam origin sama', detailEn: 'Cross-tab messaging channel' },
  { label: 'DOMParser', kind: 'class', detailId: 'Urai string HTML/XML menjadi dokumen DOM', detailEn: 'Parse HTML/XML string into Document' },
  { label: 'Uint8Array', kind: 'class', detailId: 'Typed array 8-bit unsigned integer', detailEn: '8-bit unsigned integer TypedArray' },
  { label: 'ArrayBuffer', kind: 'class', detailId: 'Buffer data biner berukuran tetap', detailEn: 'Fixed-length raw binary buffer' },
]

export const REACT_API_GLOBALS: readonly JsApiInfo[] = [
  { label: 'useState', kind: 'function', insertText: 'useState($0)', detailId: 'Hook state lokal komponen React', detailEn: 'React local state hook' },
  { label: 'useEffect', kind: 'function', insertText: 'useEffect(() => {\n  $0\n}, [])', detailId: 'Hook efek samping siklus hidup React', detailEn: 'React side-effect lifecycle hook' },
  { label: 'useMemo', kind: 'function', insertText: 'useMemo(() => $0, [])', detailId: 'Memoisasi nilai hasil komputasi React', detailEn: 'Memoize expensive computed value' },
  { label: 'useCallback', kind: 'function', insertText: 'useCallback(($0) => {\n  \n}, [])', detailId: 'Memoisasi referensi fungsi callback React', detailEn: 'Memoize callback function reference' },
  { label: 'useRef', kind: 'function', insertText: 'useRef($0)', detailId: 'Referensi mutable / elemen DOM React', detailEn: 'Mutable ref / DOM element handle' },
  { label: 'useContext', kind: 'function', insertText: 'useContext($0)', detailId: 'Membaca nilai dari React Context', detailEn: 'Read value from a React Context' },
  { label: 'useReducer', kind: 'function', insertText: 'useReducer($0, initialState)', detailId: 'Manajemen state kompleks dengan reducer', detailEn: 'Complex state transitions via reducer' },
  { label: 'useId', kind: 'function', insertText: 'useId()', detailId: 'Hasilkan ID unik aksesibilitas React', detailEn: 'Generate unique accessibility ID' },
  { label: 'useLayoutEffect', kind: 'function', insertText: 'useLayoutEffect(() => {\n  $0\n}, [])', detailId: 'Efek sinkron sebelum browser repaint', detailEn: 'Synchronous effect before browser paint' },
  { label: 'useTransition', kind: 'function', insertText: 'useTransition()', detailId: 'Tandai pembaruan UI non-blocking', detailEn: 'Mark non-blocking UI state transition' },
  { label: 'useDeferredValue', kind: 'function', insertText: 'useDeferredValue($0)', detailId: 'Tunda pembaruan nilai turunan berat', detailEn: 'Defer updating a derived value' },
  { label: 'createContext', kind: 'function', insertText: 'createContext($0)', detailId: 'Buat React Context baru', detailEn: 'Create a React Context' },
  { label: 'Fragment', kind: 'class', detailId: 'Wadah grup JSX tanpa node DOM ekstra', detailEn: 'Group JSX children without extra DOM node' },
  { label: 'Suspense', kind: 'class', detailId: 'Batas fallback loading asinkron React', detailEn: 'Async loading fallback boundary' },
  { label: 'memo', kind: 'function', insertText: 'memo($0)', detailId: 'Lewati re-render saat props tidak berubah', detailEn: 'Skip re-render when props are unchanged' },
]

export interface RuntimeMemberItem {
  label: string
  type: 'method' | 'property' | 'class' | 'constant'
  boost?: number
}

const runtimeMemberCache = new WeakMap<object, RuntimeMemberItem[]>()

/**
 * Enumerates standard own + prototype members on a safe built-in JS/DOM object or prototype
 * (excluding internal/private/deprecated underscore names).
 */
export function enumerateSafeMembers(target: unknown): RuntimeMemberItem[] {
  if (!target || (typeof target !== 'object' && typeof target !== 'function')) return []
  const obj = target as object
  const cached = runtimeMemberCache.get(obj)
  if (cached) return cached

  const items: RuntimeMemberItem[] = []
  const seen = new Set<string>(['constructor', '__proto__', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__'])
  let cur: object | null = obj
  for (let depth = 0; cur && depth < 6; depth++) {
    if (cur === Object.prototype && depth > 0) break
    let names: string[]
    try {
      names = Object.getOwnPropertyNames(cur)
    } catch {
      break
    }
    for (const name of names) {
      if (seen.has(name) || !/^[a-zA-Z$][\w$]*$/.test(name) || name.startsWith('webkit') || name.startsWith('moz')) {
        continue
      }
      seen.add(name)
      let kind: RuntimeMemberItem['type'] = 'property'
      try {
        const desc = Object.getOwnPropertyDescriptor(cur, name)
        if (desc && 'value' in desc && typeof desc.value === 'function') {
          kind = /^[A-Z]/.test(name) ? 'class' : 'method'
        } else if (desc && !desc.get && !desc.set && /^[A-Z0-9_]+$/.test(name)) {
          kind = 'constant'
        } else if (typeof (obj as Record<string, unknown>)[name] === 'function') {
          kind = /^[A-Z]/.test(name) ? 'class' : 'method'
        }
      } catch {
        // Getter on prototype (e.g. HTMLElement.prototype.innerHTML) throws Illegal invocation; treat as property.
        kind = 'property'
      }
      items.push({ label: name, type: kind, boost: -depth })
    }
    cur = Object.getPrototypeOf(cur) as object | null
  }
  runtimeMemberCache.set(obj, items)
  return items
}

/** Curated safe root objects for dotted member lookup (`document.`, `Math.`, `Array.`, `navigator.`, etc.). */
export function resolveStandardJsPath(path: readonly string[]): RuntimeMemberItem[] | null {
  if (path.length === 0) return null
  const g = globalThis as Record<string, unknown>
  const ALLOWED_ROOTS = new Set([
    'document', 'window', 'console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number',
    'Boolean', 'BigInt', 'Symbol', 'Date', 'RegExp', 'Map', 'Set', 'WeakMap', 'WeakSet',
    'Promise', 'Reflect', 'Intl', 'Error', 'URL', 'URLSearchParams', 'Headers', 'Request',
    'Response', 'FormData', 'Blob', 'File', 'FileReader', 'AbortController', 'Event',
    'CustomEvent', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history',
    'screen', 'crypto', 'performance', 'CSS', 'WebSocket', 'TextEncoder', 'TextDecoder',
    'Uint8Array', 'ArrayBuffer', 'HTMLElement', 'Element', 'Node',
  ])

  const rootName = path[0]
  if (!ALLOWED_ROOTS.has(rootName)) return null
  let cur: unknown = g[rootName]
  if (!cur) return null

  for (let i = 1; i < path.length; i++) {
    const seg = path[i]
    try {
      cur = (cur as Record<string, unknown>)[seg]
    } catch {
      return null
    }
    if (!cur || (typeof cur !== 'object' && typeof cur !== 'function')) return null
  }
  return enumerateSafeMembers(cur)
}

export type InferredJsProfile =
  | 'element'
  | 'nodelist'
  | 'classList'
  | 'style'
  | 'array'
  | 'string'
  | 'number'
  | 'response'
  | 'headers'
  | 'map'
  | 'set'
  | 'date'
  | 'url'
  | 'searchParams'
  | 'formData'
  | 'regexp'
  | 'promise'
  | 'event'
  | 'storage'

/** Resolve runtime prototype members for a known JS/DOM object profile. */
export function membersForProfile(profile: InferredJsProfile): RuntimeMemberItem[] {
  const g = globalThis as Record<string, unknown>
  const protoOf = (ctorName: string): object | null => {
    const ctor = g[ctorName] as { prototype?: object } | undefined
    return ctor?.prototype ?? null
  }
  const map: Record<InferredJsProfile, () => RuntimeMemberItem[]> = {
    element: () => [
      ...enumerateSafeMembers(protoOf('HTMLInputElement')),
      ...enumerateSafeMembers(protoOf('HTMLElement')),
      ...enumerateSafeMembers(protoOf('Element')),
      ...enumerateSafeMembers(protoOf('Node')),
      ...enumerateSafeMembers(protoOf('EventTarget')),
    ],
    nodelist: () => enumerateSafeMembers(protoOf('NodeList')),
    classList: () => enumerateSafeMembers(protoOf('DOMTokenList')),
    style: () => enumerateSafeMembers(typeof document !== 'undefined' && document.body ? document.body.style : protoOf('CSSStyleDeclaration')),
    array: () => enumerateSafeMembers(Array.prototype),
    string: () => enumerateSafeMembers(String.prototype),
    number: () => enumerateSafeMembers(Number.prototype),
    response: () => enumerateSafeMembers(protoOf('Response')),
    headers: () => enumerateSafeMembers(protoOf('Headers')),
    map: () => enumerateSafeMembers(Map.prototype),
    set: () => enumerateSafeMembers(Set.prototype),
    date: () => enumerateSafeMembers(Date.prototype),
    url: () => enumerateSafeMembers(protoOf('URL')),
    searchParams: () => enumerateSafeMembers(protoOf('URLSearchParams')),
    formData: () => enumerateSafeMembers(protoOf('FormData')),
    regexp: () => enumerateSafeMembers(RegExp.prototype),
    promise: () => enumerateSafeMembers(Promise.prototype),
    event: () => [
      ...enumerateSafeMembers(protoOf('KeyboardEvent')),
      ...enumerateSafeMembers(protoOf('MouseEvent')),
      ...enumerateSafeMembers(protoOf('InputEvent')),
      ...enumerateSafeMembers(protoOf('SubmitEvent')),
      ...enumerateSafeMembers(protoOf('Event')),
    ],
    storage: () => enumerateSafeMembers(protoOf('Storage')),
  }
  const raw = map[profile]()
  const seen = new Set<string>()
  return raw.filter((item) => {
    if (seen.has(item.label)) return false
    seen.add(item.label)
    return true
  })
}

const PROPERTY_PROFILE_MAP: Record<string, InferredJsProfile> = {
  classList: 'classList',
  style: 'style',
  children: 'nodelist',
  childNodes: 'nodelist',
  parentElement: 'element',
  firstElementChild: 'element',
  lastElementChild: 'element',
  nextElementSibling: 'element',
  previousElementSibling: 'element',
  activeElement: 'element',
  target: 'element',
  currentTarget: 'element',
  headers: 'headers',
  searchParams: 'searchParams',
  localStorage: 'storage',
  sessionStorage: 'storage',
}

/** Lightweight local variable & property receiver type inference for VS Code-like dot completions. */
export function inferReceiverProfile(docText: string, path: readonly string[]): InferredJsProfile | null {
  if (path.length === 0) return null
  const last = path[path.length - 1]
  if (last in PROPERTY_PROFILE_MAP) return PROPERTY_PROFILE_MAP[last]

  if (path.length > 1) return null
  const varName = path[0]
  if (/^(e|ev|evt|event)$/i.test(varName)) return 'event'

  const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const declRe = new RegExp(`(?:const|let|var)\\s+${escaped}\\s*(?::[^=]+)?=\\s*([^;\\n]+)`, 'g')
  let lastInit = ''
  let m: RegExpExecArray | null
  while ((m = declRe.exec(docText)) !== null) {
    lastInit = m[1].trim()
  }
  if (!lastInit) return null

  if (/document\.(?:getElementById|querySelector|createElement)\b|\.closest\(/.test(lastInit)) return 'element'
  if (/document\.(?:querySelectorAll|getElementsBy\w+)\b/.test(lastInit)) return 'nodelist'
  if (/^\[|Array\.from\(|Array\.of\(|\.(?:map|filter|slice|concat|flat|flatMap|split)\(/.test(lastInit)) return 'array'
  if (/^["'`]|String\(|\.(?:trim|toLowerCase|toUpperCase|replace|substring|join)\(/.test(lastInit)) return 'string'
  if (/^(?:await\s+)?fetch\(/.test(lastInit)) return 'response'
  if (/^new\s+Map\b/.test(lastInit)) return 'map'
  if (/^new\s+Set\b/.test(lastInit)) return 'set'
  if (/^new\s+Date\b/.test(lastInit)) return 'date'
  if (/^new\s+URL\b/.test(lastInit)) return 'url'
  if (/^new\s+URLSearchParams\b/.test(lastInit)) return 'searchParams'
  if (/^new\s+FormData\b/.test(lastInit)) return 'formData'
  if (/^new\s+RegExp\b|^\/[^/]+\/[dgimsuvy]*$/.test(lastInit)) return 'regexp'
  if (/^new\s+Promise\b|Promise\./.test(lastInit)) return 'promise'
  if (/^new\s+Headers\b/.test(lastInit)) return 'headers'
  if (/^-?\d+(?:\.\d+)?$/.test(lastInit)) return 'number'
  return null
}
