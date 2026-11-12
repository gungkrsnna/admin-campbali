/**
 * Where every piece of site text appears, page by page and section by section (top to bottom),
 * so the Page Copy editor can show it in context instead of as raw dictionary keys.
 *
 * Paths point into the site's dictionaries (frontend/src/i18n/dictionaries/*.json, stored in the
 * page_content table): "home.titleLead" is section "home", key "titleLead".
 * Keep this in step with the frontend pages in frontend/src/app/[lang]/ when their layout changes.
 * Texts that are in the data but not listed here still show up under "Other texts", so nothing is lost.
 */

export type Role =
  | 'heading'
  | 'label'
  | 'body'
  | 'button'
  | 'link'
  | 'caption'
  | 'alt'
  | 'field'
  | 'placeholder'
  | 'error'
  | 'state'
  | 'sr'
  | 'message'
  | 'pdf'
  | 'google'

export const roleInfo: Record<Role, { name: string; hidden?: string }> = {
  heading: { name: 'Heading' },
  label: { name: 'Small label' },
  body: { name: 'Text' },
  button: { name: 'Button' },
  link: { name: 'Link' },
  caption: { name: 'Caption' },
  alt: { name: 'Photo description', hidden: 'Not shown on the page. Read by Google and screen readers.' },
  field: { name: 'Form label' },
  placeholder: { name: 'Placeholder', hidden: 'Grey hint inside an empty field.' },
  error: { name: 'Error message', hidden: 'Only shown when something is missing.' },
  state: { name: 'Status message', hidden: 'Only shown in a certain situation.' },
  sr: { name: 'Screen readers', hidden: 'Not shown on the page. Read aloud for visitors using a screen reader.' },
  message: { name: 'WhatsApp text', hidden: 'Not shown on the page. Prefilled in the WhatsApp message the visitor sends.' },
  pdf: { name: 'PDF', hidden: 'Not shown on the page. Printed in the PDF of the order list.' },
  google: { name: 'Google', hidden: 'Not shown on the page. Used for the browser tab and Google results.' },
}

/**
 * The page photos the admin can change. They are stored with the page texts (section "images",
 * the same in both languages); `original` is the site's built-in photo, used until one is saved.
 */
export const imageSlots = {
  homeHero: { label: 'Home › Hero photo', original: '/images/home/model-dynamic-coconut-oil.webp', alt: 'home.businessImageAlt' },
  homeStory: { label: 'Home › Our story photo', original: '/images/home/variants/coconut-linen.webp', alt: 'home.journeyImageAlt' },
  homeProcess: { label: 'Home › Process background', original: '/images/home/symmetrical/coconut-grove.webp', alt: 'home.processImageAlt' },
  homeWholesale: { label: 'Home › Wholesale photo', original: '/images/home/model-satin-turn-coconut-oil.webp', alt: 'home.luxeHeroAlt' },
  storyLandscape: { label: 'Our Story › Landscape photo', original: '/images/home/symmetrical/coconut-grove.webp', alt: 'home.processImageAlt' },
  storyPurpose: { label: 'Our Story › Purpose photo', original: '/images/home/coconut-oil-elegant-still-life.webp', alt: 'story.productImageAlt' },
  ethosHero: { label: 'Ethos › Hero photo', original: '/images/home/variants/coconut-grove.webp', alt: 'ethos.heroImageAlt' },
  communityHero: { label: 'Community › Hero photo', original: '/images/home/symmetrical/coconut-grove.webp', alt: 'community.landscapeAlt' },
} as const
export type ImageSlot = keyof typeof imageSlots

export type TextSpec = { kind: 'text'; path: string; label: string; role: Role; note?: string }
export type ListSpec = {
  kind: 'list'
  path: string
  label: string
  /** Name of one item, e.g. "Step" → "Step 1", "Step 2". */
  item: string
  /** Fields of each item; `key` undefined means the items are plain texts (paragraphs). */
  fields: { key?: string; label: string; role: Role }[]
  note?: string
}
export type ManagedSpec = { kind: 'managed'; text: string; to: string; menu: string }
export type Spec = TextSpec | ListSpec | ManagedSpec

export type SectionSpec = {
  title: string
  description?: string
  /** The photo shown in this section, editable in the visual editor. */
  image?: ImageSlot
  note?: string
  items: Spec[]
}
export type PageSpec = {
  id: string
  title: string
  /** Path on the site, for "View page". Undefined for groups that aren't a single page. */
  url?: string
  description?: string
  group: 'page' | 'other'
  sections: SectionSpec[]
}

const t = (path: string, label: string, role: Role, note?: string): TextSpec => ({ kind: 'text', path, label, role, note })
const list = (path: string, label: string, item: string, fields: ListSpec['fields'], note?: string): ListSpec => ({ kind: 'list', path, label, item, fields, note })
const managed = (text: string, menu: string, to: string): ManagedSpec => ({ kind: 'managed', text, menu, to })

const steps = (path: string, item = 'Step') => list(path, 'Steps', item, [{ key: 'title', label: 'Title', role: 'heading' }, { key: 'text', label: 'Text', role: 'body' }])
const addToList = [
  t('products.size', 'Label above the sizes', 'label'),
  t('products.addToList', 'Add-to-list button', 'button'),
  t('products.inList', 'Button after adding', 'button', 'Replaces the add button once the product is in the visitor’s list.'),
]
const timeline: SectionSpec = {
  title: 'Timeline',
  description: 'Year tabs with a chapter for each milestone. Plays through the chapters by itself.',
  items: [
    t('story.timelineTitle', 'Heading', 'heading'),
    managed('The years, titles and stories of each chapter', 'Milestones', '/milestones'),
    t('story.timelineControls.chapter', 'Small label before the number, e.g. “Chapter 01”', 'label'),
    t('story.timelineControls.previous', 'Previous button', 'button'),
    t('story.timelineControls.next', 'Next button', 'button'),
    t('story.timelineControls.chooseYear', 'Year tabs', 'sr'),
  ],
}
const orderingSteps: SectionSpec = {
  title: 'How ordering works',
  items: [
    t('products.orderingTitle', 'Heading', 'heading'),
    t('products.orderingIntro', 'Intro text', 'body'),
    t('nav.inquiry', 'Button to My List', 'button'),
    steps('home.orderSteps'),
  ],
}

export const pageMap: PageSpec[] = [
  {
    id: 'home',
    title: 'Home',
    url: '',
    group: 'page',
    sections: [
      {
        title: 'Hero (top banner)',
        description: 'The first thing visitors see: large heading over the photo.',
        image: 'homeHero',
        items: [
          t('home.titleLead', 'Heading, line 1', 'heading'),
          t('home.titleAccent', 'Heading, line 2', 'heading', 'Shown in italics, in gold.'),
          t('home.tagline', 'Intro text', 'body'),
          t('home.ctaProducts', 'Main button (to Products)', 'button'),
          t('home.ctaStory', 'Text link (to Our Story)', 'link'),
          t('home.businessImageAlt', 'Photo description', 'alt'),
        ],
      },
      {
        title: 'Numbers strip',
        description: 'Four large numbers with a short text under each.',
        items: [list('home.stats', 'Numbers', 'Number', [{ key: 'value', label: 'Number', role: 'heading' }, { key: 'label', label: 'Text under the number', role: 'body' }])],
      },
      {
        title: 'Our story preview',
        image: 'homeStory',
        items: [
          t('nav.story', 'Small label above the heading', 'label', 'Same text as the Our Story menu item.'),
          t('home.journeyHighlight', 'Heading', 'heading'),
          t('home.journeyYear', 'Year under the photo', 'caption'),
          t('home.journeyMilestone', 'Caption next to the year', 'caption'),
          list('home.journeyStory', 'Paragraphs', 'Paragraph', [{ label: 'Text', role: 'body' }]),
          t('home.journeyLink', 'Text link (to Our Story)', 'link'),
          t('home.journeyImageAlt', 'Photo description', 'alt'),
        ],
      },
      timeline,
      {
        title: 'Signature product',
        description: 'Spotlight on Virgin Coconut Oil with its sizes and an add-to-list button.',
        items: [
          t('home.vcoLabel', 'Small label above the heading', 'label'),
          managed('Product name, description, photo and sizes', 'Products', '/products'),
          ...addToList,
          t('home.vcoDetails', 'Text link (to the product page)', 'link'),
        ],
      },
      {
        title: 'Cold-pressed oils collection',
        items: [
          t('home.luxeCollection', 'Small label above the heading', 'label', 'Also used above the Natural pantry heading.'),
          managed('Heading: the name of the “oils” category', 'Categories', '/categories'),
          t('home.oilsIntro', 'Intro text', 'body'),
          t('home.viewAll', 'Text link (to Products)', 'link'),
          managed('The product cards', 'Products', '/products'),
        ],
      },
      {
        title: 'Natural pantry collection',
        items: [
          t('home.luxeCollection', 'Small label above the heading', 'label'),
          managed('Heading: the name of the “foods” category', 'Categories', '/categories'),
          t('home.pantryIntro', 'Intro text', 'body'),
          t('home.viewAll', 'Text link (to Products)', 'link'),
          managed('The product cards', 'Products', '/products'),
        ],
      },
      {
        title: 'From village to bottle',
        description: 'Four production steps over a full-width photo.',
        image: 'homeProcess',
        items: [
          t('home.luxeProcess', 'Small label above the heading', 'label'),
          t('home.processTitle', 'Heading', 'heading'),
          t('home.processIntro', 'Intro text', 'body'),
          steps('home.processSteps'),
          t('home.processImageAlt', 'Photo description', 'alt'),
        ],
      },
      {
        title: 'What we believe',
        items: [
          t('home.ethosTitle', 'Small label above the statement', 'label'),
          t('ethos.mission', 'Large statement', 'heading'),
          list('ethos.pillars', 'Values', 'Value', [{ key: 'title', label: 'Title', role: 'heading' }, { key: 'text', label: 'Text', role: 'body' }], 'The longer “detail” text of each value is on the Ethos page.'),
          t('home.ethosLink', 'Text link (to Ethos)', 'link'),
        ],
      },
      {
        title: 'Testimonials',
        items: [t('home.testimonialsTitle', 'Heading', 'heading'), managed('The quotes and names', 'Testimonials', '/testimonials')],
      },
      {
        title: 'How to order',
        description: 'Three steps next to an example WhatsApp chat.',
        items: [
          t('home.orderTitle', 'Heading', 'heading'),
          t('home.orderIntro', 'Intro text', 'body'),
          steps('home.orderSteps'),
          t('home.orderCta', 'Button (to Products)', 'button'),
          t('home.orderPreviewLabel', 'Caption above the example chat', 'caption'),
          t('home.orderSampleName', 'Customer name in the example chat', 'caption'),
          t('home.orderSampleCity', 'Customer city in the example chat', 'caption'),
          t('home.orderReply', 'Reply bubble in the example chat', 'body'),
        ],
        note: 'The customer’s message in the example chat is built from the texts under Messages & PDF.',
      },
      {
        title: 'Questions (FAQ)',
        items: [
          t('home.faqTitle', 'Heading', 'heading'),
          t('home.faqIntro', 'Intro text', 'body'),
          managed('The questions and answers', 'FAQs', '/faqs'),
          t('home.faqMore', 'Link to ask on WhatsApp', 'link'),
          t('home.faqMessage', 'Message for that link', 'message', 'Also used by the WhatsApp link in the footer.'),
        ],
      },
      {
        title: 'Wholesale',
        image: 'homeWholesale',
        items: [
          t('home.businessLabel', 'Small label above the heading', 'label'),
          t('home.businessTitle', 'Heading', 'heading'),
          t('home.businessText', 'Text', 'body'),
          t('home.businessWhatsApp', 'WhatsApp button', 'button'),
          t('home.businessMessage', 'Message for that button', 'message'),
          t('home.businessContact', 'Text link (to Contact)', 'link'),
          t('home.luxeHeroAlt', 'Photo description', 'alt'),
        ],
      },
    ],
  },
  {
    id: 'our-story',
    title: 'Our Story',
    url: '/our-story',
    group: 'page',
    sections: [
      {
        title: 'Hero',
        items: [
          t('story.title', 'Small label above the heading', 'label', 'Also the page name in the browser tab.'),
          t('story.titleLead', 'Heading, line 1', 'heading'),
          t('story.titleAccent', 'Heading, line 2', 'heading', 'Shown in italics.'),
          t('story.intro', 'Intro text', 'body'),
          t('story.discover', 'Scroll-down link', 'link'),
        ],
      },
      {
        title: 'Landscape photo',
        image: 'storyLandscape',
        items: [
          t('story.landscapeCaption', 'Caption, left', 'caption'),
          t('story.since', 'Caption, right', 'caption', 'Also the small label of the Origins section.'),
          t('home.processImageAlt', 'Photo description', 'alt'),
        ],
      },
      {
        title: 'Origins',
        items: [
          t('story.since', 'Small label above the heading', 'label'),
          t('story.originsTitle', 'Heading', 'heading'),
          list('story.origins', 'Paragraphs', 'Paragraph', [{ label: 'Text', role: 'body' }]),
        ],
      },
      timeline,
      {
        title: 'Our purpose',
        image: 'storyPurpose',
        items: [
          t('home.vcoLabel', 'Caption under the photo', 'caption'),
          t('story.purposeLabel', 'Small label above the heading', 'label'),
          t('ethos.title', 'Heading', 'heading', 'Also the page name of Ethos.'),
          t('ethos.intro', 'Text', 'body'),
          t('home.ethosLink', 'Text link (to Ethos)', 'link'),
          t('story.productImageAlt', 'Photo description', 'alt'),
        ],
      },
      {
        title: 'Closing',
        items: [
          t('ethos.missionTitle', 'Small heading', 'label'),
          t('ethos.mission', 'Large statement', 'heading'),
          t('story.closing', 'Text', 'body'),
          t('home.ctaProducts', 'Button (to Products)', 'button'),
          t('home.ethosLink', 'Text link (to Ethos)', 'link'),
        ],
      },
    ],
  },
  {
    id: 'ethos',
    title: 'Ethos',
    url: '/ethos',
    group: 'page',
    sections: [
      {
        title: 'Hero',
        image: 'ethosHero',
        items: [
          t('nav.ethos', 'Small label above the heading', 'label', 'Same text as the Ethos menu item.'),
          t('ethos.heroLead', 'Heading, line 1', 'heading'),
          t('ethos.heroAccent', 'Heading, line 2', 'heading', 'Shown in italics.'),
          t('ethos.heroIntro', 'Intro text', 'body'),
          t('ethos.discover', 'Scroll-down link', 'link'),
          t('contact.locationValue', 'Caption on the photo', 'caption', 'Same text as the location on the Contact page.'),
          t('ethos.heroImageAlt', 'Photo description', 'alt'),
        ],
      },
      { title: 'Our belief', items: [t('ethos.beliefTitle', 'Heading', 'heading'), t('ethos.intro', 'Large text', 'body')] },
      {
        title: 'Core values',
        items: [
          t('ethos.pillarsTitle', 'Heading', 'heading'),
          t('ethos.pillarsIntro', 'Intro text', 'body'),
          list('ethos.pillars', 'Values', 'Value', [
            { key: 'title', label: 'Title', role: 'heading' },
            { key: 'text', label: 'Short text under the title', role: 'body' },
            { key: 'detail', label: 'Longer text on the right', role: 'body' },
          ]),
        ],
      },
      { title: 'Mission', items: [t('ethos.missionTitle', 'Small heading', 'label'), t('ethos.mission', 'Large statement', 'heading')] },
      {
        title: 'Closing',
        items: [
          t('ethos.closingLabel', 'Small label above the heading', 'label'),
          t('ethos.closingTitle', 'Heading', 'heading'),
          t('ethos.closingText', 'Text', 'body'),
          t('home.ctaProducts', 'Button (to Products)', 'button'),
          t('home.ctaStory', 'Text link (to Our Story)', 'link'),
        ],
      },
    ],
  },
  {
    id: 'community',
    title: 'Community',
    url: '/community',
    group: 'page',
    sections: [
      {
        title: 'Hero',
        image: 'communityHero',
        items: [
          t('community.title', 'Small label above the heading', 'label', 'Also the page name in the browser tab.'),
          t('community.heroLead', 'Heading, line 1', 'heading'),
          t('community.heroAccent', 'Heading, line 2', 'heading', 'Shown in italics.'),
          t('community.heroIntro', 'Intro text', 'body'),
          t('community.discover', 'Scroll-down link', 'link'),
          t('community.landscapeCaption', 'Caption on the photo, left', 'caption'),
          t('contact.locationValue', 'Caption on the photo, right', 'caption', 'Same text as the location on the Contact page.'),
          t('community.landscapeAlt', 'Photo description', 'alt'),
        ],
      },
      {
        title: 'Village connections',
        items: [
          t('community.peopleLabel', 'Small label above the heading', 'label'),
          t('community.peopleTitle', 'Heading', 'heading'),
          t('community.intro', 'Intro text', 'body'),
          list('community.partners', 'Cards', 'Card', [
            { key: 'label', label: 'Small tag', role: 'label' },
            { key: 'title', label: 'Title', role: 'heading' },
            { key: 'text', label: 'Text', role: 'body' },
          ]),
        ],
      },
      {
        title: 'Shared purpose',
        items: [
          t('community.purposeLabel', 'Small label above the heading', 'label'),
          t('community.purposeLead', 'Heading, line 1', 'heading'),
          t('community.purposeAccent', 'Heading, line 2', 'heading', 'Shown in italics.'),
          t('community.purposeTitle', 'Sub-heading', 'heading'),
          t('community.purposeText', 'Paragraph 1', 'body'),
          t('community.futureText', 'Paragraph 2', 'body'),
          t('community.ethosLink', 'Text link (to Ethos)', 'link'),
        ],
      },
      {
        title: 'Closing',
        items: [
          t('community.closingLabel', 'Small label above the heading', 'label'),
          t('community.closingTitle', 'Heading', 'heading'),
          t('community.closingText', 'Text', 'body'),
          t('contact.whatsapp', 'WhatsApp button', 'button', 'Same text as the WhatsApp link on the Contact page.'),
          t('community.whatsappMessage', 'Message for that button', 'message'),
          t('home.ctaProducts', 'Text link (to Products)', 'link'),
        ],
      },
    ],
  },
  {
    id: 'products',
    title: 'Products',
    url: '/products',
    group: 'page',
    sections: [
      {
        title: 'Hero',
        items: [
          t('products.title', 'Small label above the heading', 'label', 'Also the page name in the browser tab.'),
          t('products.heroLead', 'Heading, line 1', 'heading'),
          t('products.heroAccent', 'Heading, line 2', 'heading', 'Shown in italics.'),
          t('products.heroIntro', 'Intro text', 'body'),
          t('nav.inquiry', 'Text link (to My List)', 'link'),
        ],
      },
      {
        title: 'Catalogue',
        description: 'Category filter and the product cards.',
        items: [
          t('products.all', 'Filter: all products', 'button'),
          managed('Category filters and tags', 'Categories', '/categories'),
          t('products.productSingular', 'Count word for one product, e.g. “1 product”', 'caption'),
          t('products.productPlural', 'Count word for several, e.g. “7 products”', 'caption'),
          managed('Product names, summaries, photos and sizes', 'Products', '/products'),
          ...addToList,
          t('products.filterLabel', 'Filter buttons', 'sr'),
          t('products.viewProduct', 'Product photo link', 'sr'),
          t('products.catalogue', 'Catalogue heading', 'sr'),
        ],
      },
      orderingSteps,
    ],
  },
  {
    id: 'product-page',
    title: 'Product page',
    url: '/products/virgin-coconut-oil',
    description: 'The page of each product. Texts here are shared by all products.',
    group: 'page',
    sections: [
      {
        title: 'Product',
        items: [
          t('products.back', 'Back link', 'link'),
          managed('Name, description, photo, category and sizes of each product', 'Products', '/products'),
          t('products.availableSizes', 'Label before the size (one-size products)', 'label'),
          ...addToList,
          t('products.inquiryNote', 'Note under the button', 'body'),
          t('nav.inquiry', 'Text link (to My List)', 'link'),
        ],
      },
      { title: 'Related products', items: [t('products.relatedTitle', 'Heading', 'heading'), t('inquiry.browse', 'Link (to all products)', 'link')] },
      orderingSteps,
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    url: '/contact',
    group: 'page',
    sections: [
      {
        title: 'Hero and direct contact',
        note: 'The WhatsApp row only shows when a WhatsApp number is set in Site Settings. Its small “WhatsApp” label is fixed in the design.',
        items: [
          t('contact.title', 'Small label above the heading', 'label', 'Also the page name in the browser tab.'),
          t('contact.heroLead', 'Heading, line 1', 'heading'),
          t('contact.heroAccent', 'Heading, line 2', 'heading', 'Shown in italics.'),
          t('contact.intro', 'Intro text', 'body'),
          t('contact.directLabel', 'Small heading above the contact details', 'label'),
          t('contact.whatsapp', 'WhatsApp link', 'link'),
          t('contact.whatsappText', 'Text under the WhatsApp link', 'body'),
          t('contact.quickMessage', 'Message for that link', 'message'),
          t('contact.email', 'Email label', 'label'),
          t('contact.emailText', 'Text under the email address', 'body'),
          t('contact.location', 'Location label', 'label'),
          t('contact.locationValue', 'Location', 'heading', 'Also used as a photo caption on Ethos and Community.'),
          t('contact.locationText', 'Text under the location', 'body'),
        ],
      },
      {
        title: 'Contact form',
        description: 'Sends the visitor’s message to WhatsApp.',
        items: [
          t('contact.form.title', 'Heading', 'heading'),
          t('contact.form.intro', 'Intro text', 'body'),
          t('contact.form.name', 'Name field', 'field'),
          t('contact.form.business', 'Business field', 'field'),
          t('contact.form.optional', 'Word after optional fields, e.g. “(optional)”', 'field'),
          t('contact.form.topic', 'Topic field', 'field'),
          t('contact.form.topics.general', 'Topic choice 1', 'field'),
          t('contact.form.topics.products', 'Topic choice 2', 'field'),
          t('contact.form.topics.wholesale', 'Topic choice 3', 'field'),
          t('contact.form.topics.partnership', 'Topic choice 4', 'field'),
          t('contact.form.message', 'Message field', 'field'),
          t('contact.form.messagePlaceholder', 'Hint inside the message field', 'placeholder'),
          t('contact.form.requiredNote', 'Note about required fields', 'caption'),
          t('contact.form.submit', 'Send button', 'button'),
          t('contact.form.handoffNote', 'Note under the button', 'caption'),
          t('contact.form.requiredName', 'Name missing', 'error'),
          t('contact.form.requiredMessage', 'Message missing', 'error'),
          t('contact.form.unavailable', 'Shown when no WhatsApp number is set', 'state'),
          t('contact.form.draftReady', 'Shown after sending', 'state'),
          t('contact.form.reopen', 'Link to open WhatsApp again', 'state'),
        ],
      },
      {
        title: 'Already choosing products',
        items: [
          t('contact.orderLabel', 'Small label above the heading', 'label'),
          t('contact.orderTitle', 'Heading', 'heading'),
          t('contact.orderText', 'Text', 'body'),
          t('inquiry.browse', 'Button (to Products)', 'button'),
          t('nav.inquiry', 'Text link (to My List)', 'link'),
        ],
      },
      {
        title: 'Questions',
        items: [
          t('contact.questionsLabel', 'Small label above the heading', 'label'),
          t('contact.questionsTitle', 'Heading', 'heading'),
          list('contact.questions', 'Questions', 'Question', [{ key: 'question', label: 'Question', role: 'heading' }, { key: 'answer', label: 'Answer', role: 'body' }], 'These questions are only on the Contact page. The FAQ on Home is managed in FAQs.'),
        ],
      },
    ],
  },
  {
    id: 'my-list',
    title: 'My List',
    url: '/inquiry',
    description: 'The visitor’s list of chosen products, sent to you on WhatsApp or saved as a PDF.',
    group: 'page',
    sections: [
      { title: 'Header', items: [t('inquiry.title', 'Heading', 'heading', 'Also the page name in the browser tab and on the floating list button.'), t('inquiry.intro', 'Intro text', 'body')] },
      { title: 'Empty list', description: 'Shown while the visitor hasn’t added anything.', items: [t('inquiry.empty', 'Message', 'body'), t('inquiry.browse', 'Button (to Products)', 'button')] },
      {
        title: 'Chosen products',
        items: [t('inquiry.qty', 'Quantity label', 'label'), t('inquiry.remove', 'Remove button', 'button'), t('inquiry.clear', 'Clear-the-list button', 'button')],
      },
      {
        title: 'Your details',
        items: [
          t('inquiry.detailsTitle', 'Heading', 'heading'),
          t('inquiry.name', 'Name field', 'field'),
          t('inquiry.phone', 'Phone field', 'field'),
          t('inquiry.city', 'City field', 'field'),
          t('inquiry.notes', 'Notes field', 'field'),
          t('inquiry.notesPlaceholder', 'Hint inside the notes field', 'placeholder'),
          t('inquiry.required', 'Name missing', 'error'),
          t('inquiry.sendWhatsApp', 'Send-on-WhatsApp button', 'button'),
          t('inquiry.downloadPdf', 'Download-PDF button', 'button'),
        ],
      },
    ],
  },
  {
    id: 'header-footer',
    title: 'Menu & footer',
    url: '',
    description: 'Shown on every page.',
    group: 'page',
    sections: [
      {
        title: 'Menu',
        note: 'The order of the menu is fixed in the design.',
        items: [
          t('nav.home', 'Home', 'link'),
          t('nav.story', 'Our Story', 'link'),
          t('nav.ethos', 'Ethos', 'link'),
          t('nav.products', 'Products', 'link'),
          t('nav.community', 'Community', 'link'),
          t('nav.contact', 'Contact', 'link'),
          t('nav.inquiry', 'Floating “My List” button', 'button', 'Appears at the bottom right once the visitor adds a product.'),
          t('nav.language', 'Language switch', 'sr', 'Also the heading of the language links in the footer.'),
          t('nav.openMenu', 'Open-menu button on phones', 'sr'),
          t('nav.closeMenu', 'Close-menu button on phones', 'sr'),
        ],
      },
      {
        title: 'Footer',
        note: 'The email, location and Instagram address come from Site Settings.',
        items: [
          t('footer.tagline', 'Short text under the logo', 'body'),
          t('footer.motto', 'Small line under that', 'caption'),
          t('footer.explore', 'Heading above the page links', 'label'),
          t('footer.contactTitle', 'Heading above the contact details', 'label'),
          t('footer.whatsapp', 'WhatsApp link', 'link', 'Its message is the one under Home › Questions (FAQ).'),
          t('footer.follow', 'Heading above the social links', 'label'),
          t('footer.instagram', 'Instagram link', 'link'),
          t('footer.rights', 'Text after “© Camp Bali.”', 'caption'),
        ],
      },
    ],
  },
  {
    id: 'not-found',
    title: 'Page not found',
    url: '/page-that-does-not-exist',
    description: 'Shown when an address doesn’t exist (error 404).',
    group: 'page',
    sections: [{ title: 'Message', items: [t('notFound.title', 'Heading', 'heading'), t('notFound.back', 'Button (to Home)', 'button')] }],
  },
  {
    id: 'seo',
    title: 'Browser tab & Google',
    description: 'The page names in the browser tab and the short descriptions Google shows in search results. The page names of the other pages are their small labels above the heading.',
    group: 'other',
    sections: [
      { title: 'Home and default', items: [t('meta.title', 'Site name in the browser tab', 'google'), t('meta.description', 'Description in Google', 'google')] },
      {
        title: 'Descriptions of the other pages',
        items: [
          t('story.description', 'Our Story', 'google'),
          t('ethos.description', 'Ethos', 'google'),
          t('community.description', 'Community', 'google'),
          t('products.description', 'Products', 'google'),
          t('contact.description', 'Contact', 'google'),
        ],
      },
    ],
  },
  {
    id: 'messages',
    title: 'Messages & PDF',
    description: 'Texts sent in WhatsApp messages or printed in the order-list PDF. Visitors see them in WhatsApp or the PDF, not on the page.',
    group: 'other',
    sections: [
      {
        title: 'Order list sent on WhatsApp',
        note: 'Also shown in the example chat on Home.',
        items: [t('inquiry.messageGreeting', 'Opening line', 'message'), t('inquiry.messageClosing', 'Closing line', 'message')],
      },
      { title: 'Contact form sent on WhatsApp', items: [t('contact.messageGreeting', 'Opening line', 'message'), t('contact.messageClosing', 'Closing line', 'message')] },
      {
        title: 'Prefilled messages of WhatsApp buttons',
        items: [
          t('home.faqMessage', 'Home › Questions and the footer link', 'message'),
          t('home.businessMessage', 'Home › Wholesale button', 'message'),
          t('community.whatsappMessage', 'Community › Closing button', 'message'),
          t('contact.quickMessage', 'Contact › WhatsApp link', 'message'),
        ],
      },
      {
        title: 'Order-list PDF',
        items: [
          t('inquiry.docTitle', 'Title, after “Camp Bali”', 'pdf'),
          t('inquiry.date', 'Date label', 'pdf'),
          t('inquiry.product', 'Column: product', 'pdf'),
          t('inquiry.size', 'Column: size', 'pdf'),
          t('inquiry.code', 'Column: code', 'pdf'),
          t('inquiry.qty', 'Column: quantity', 'pdf', 'Also the quantity label on the My List page.'),
        ],
      },
    ],
  },
]

/**
 * Texts that are stored but not shown anywhere on the live site (left over from earlier design
 * concepts, or a "coming soon" page that is no longer used). Hidden from the editor.
 */
export const unusedPaths = [
  'home.sunHeroAlt',
  'home.sunVcoAlt',
  'home.sunHeroAlt3',
  'home.motionScroll',
  'home.motionScrollHint',
  'home.motionCircle',
  'products.intro',
  'story.lead',
  'comingSoon',
]

/** Texts stored with the page texts but edited in another menu (the website takes them from there). */
export const managedPaths = ['story.timeline', 'products.categories']
