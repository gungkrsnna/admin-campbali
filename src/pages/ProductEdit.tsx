import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useConfirm } from '../components/ConfirmDialog'
import { Icon } from '../components/icons'
import { ImageUpload } from '../components/ImageUpload'
import { Select } from '../components/Select'
import { SortableList } from '../components/Sortable'
import { useToast } from '../components/Toast'
import { Button, ErrorBox, FieldError, FormSection, invalidInput, Loading, LocalizedField, PageHeader, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { categoryColor } from '../lib/categoryColors'
import { nextSortOrder } from '../lib/reorder'
import { emptyLocalized, type Category, type Product, type Variant } from '../lib/types'
import { useUnsavedChanges } from '../lib/useUnsavedChanges'
import { categoriesQuery, productsQuery } from './Products'
import { DELETED_AS_DRAFT, SAVED_AS_DRAFT } from '../lib/publish'

/** A size row in the form. `key` identifies the row while dragging, including rows not saved yet. */
type VariantRow = Variant & { key: string }
type Draft = Omit<Product, 'id' | 'created_at' | 'updated_at' | 'variants'> & { variants: VariantRow[] }
/** Field path → message, e.g. "name.en", "slug", "variant.<key>.code". */
type Errors = Record<string, string>

const toRow = (variant: Variant): VariantRow => ({ ...variant, key: variant.id ?? crypto.randomUUID() })
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export function ProductEdit() {
  const { id } = useParams()
  const isNew = id === 'new'
  const products = useQuery(productsQuery)
  const categories = useQuery(categoriesQuery)

  if (products.error || categories.error) return <ErrorBox error={products.error ?? categories.error} />
  if (!products.data || !categories.data) return <Loading />

  const existing = products.data.find((p) => p.id === id)
  if (!isNew && !existing) return <ErrorBox error={new Error('Product not found.')} />

  const initial: Draft = existing
    ? { ...existing, variants: existing.variants.map(toRow) }
    : {
        slug: '',
        category_slug: categories.data[0]?.slug ?? '',
        name: emptyLocalized(),
        summary: emptyLocalized(),
        description: emptyLocalized(),
        image_url: null,
        sort_order: nextSortOrder(products.data),
        is_published: false,
        variants: [toRow({ code: '', size: '' })],
      }

  // `key` resets the form when moving between products.
  return <ProductForm key={id} id={isNew ? null : id!} initial={initial} categories={categories.data} others={products.data.filter((p) => p.id !== id)} />
}

/** Checks the form before saving, so mistakes show next to the field instead of as a server error. */
function validate(draft: Draft, others: Product[]): Errors {
  const errors: Errors = {}
  if (!draft.name.en.trim()) errors['name.en'] = 'Enter the English name.'
  if (!draft.name.id.trim()) errors['name.id'] = 'Enter the Indonesian name.'

  if (!draft.slug) errors.slug = 'Enter a page address.'
  else if (!SLUG.test(draft.slug)) errors.slug = 'Use lowercase letters, numbers and single hyphens only.'
  else if (others.some((p) => p.slug === draft.slug)) errors.slug = 'Another product already uses this address.'

  if (!draft.category_slug) errors.category = 'Choose a category.'

  const codeOwner = new Map(others.flatMap((p) => p.variants.map((v) => [v.code.toLowerCase(), p.name.en] as const)))
  const seen = new Set<string>()
  for (const v of draft.variants) {
    const code = v.code.trim().toLowerCase()
    if (!code) errors[`variant.${v.key}.code`] = 'Enter a SKU code.'
    else if (seen.has(code)) errors[`variant.${v.key}.code`] = 'This code is listed twice.'
    else if (codeOwner.has(code)) errors[`variant.${v.key}.code`] = `Already used by ${codeOwner.get(code)}.`
    seen.add(code)
    if (!v.size.trim()) errors[`variant.${v.key}.size`] = 'Enter a size.'
  }
  return errors
}

function ProductForm({ id, initial, categories, others }: { id: string | null; initial: Draft; categories: Category[]; others: Product[] }) {
  const [baseline, setBaseline] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [submitted, setSubmitted] = useState(false)
  const [slugTouched, setSlugTouched] = useState(id !== null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline)
  const { allowNavigation } = useUnsavedChanges(dirty)
  // Errors appear after the first Save attempt, then update as the user fixes them.
  const errors = submitted ? validate(draft, others) : {}

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const setVariants = (variants: VariantRow[]) => set('variants', variants)

  const body = () => ({
    ...draft,
    variants: draft.variants.map(({ code, size }) => ({ code: code.trim(), size: size.trim() })),
  })

  const save = useMutation({
    mutationFn: () =>
      id ? api<Product>(`/products/${id}`, { method: 'PUT', body: body() }) : api<Product>('/products', { method: 'POST', body: body() }),
    onSuccess: (product) => {
      toast.success(SAVED_AS_DRAFT)
      setBaseline(draft)
      setSubmitted(false)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      if (!id) {
        allowNavigation()
        navigate(`/products/${product.id}`, { replace: true })
      }
    },
    onError: toast.error,
  })

  const remove = useMutation({
    mutationFn: () => api(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(DELETED_AS_DRAFT)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      allowNavigation()
      navigate('/products', { replace: true })
    },
    onError: toast.error,
  })

  function submit() {
    setSubmitted(true)
    if (Object.keys(validate(draft, others)).length) {
      toast.error('Some fields need attention.')
      // Bring the first problem into view once the error styles have rendered.
      requestAnimationFrame(() => {
        const first = document.querySelector<HTMLElement>('[aria-invalid="true"]')
        first?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        first?.focus({ preventScroll: true })
      })
      return
    }
    save.mutate()
  }

  async function discard() {
    const ok = await confirm({ title: 'Discard changes?', message: 'Everything you changed since the last save will be lost.', confirmLabel: 'Discard', tone: 'danger' })
    if (ok) {
      setDraft(baseline)
      setSubmitted(false)
    }
  }

  async function deleteProduct() {
    const ok = await confirm({
      title: `Delete ${baseline.name.en || 'this product'}?`,
      message: 'It will be removed from the site straight away. This can’t be undone.',
      confirmLabel: 'Delete product',
      tone: 'danger',
    })
    if (ok) remove.mutate()
  }

  const busy = save.isPending || remove.isPending

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <PageHeader
        title={id ? baseline.name.en || 'Product' : 'New product'}
        parent={{ to: '/products', label: 'Products' }}
        actions={
          <>
            {dirty && (
              <>
                <span className="hidden items-center gap-1.5 self-center text-xs text-amber-700 sm:flex">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  Unsaved changes
                </span>
                {id && (
                  <Button onClick={discard} disabled={busy}>
                    Discard
                  </Button>
                )}
              </>
            )}
            <Button type="submit" variant="primary" disabled={busy || (id !== null && !dirty)}>
              {save.isPending ? 'Saving…' : id ? 'Save' : 'Create product'}
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-3">
        {/* Main column */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <FormSection title="Details" description="Shown on the product card and the product page, in both languages.">
            <LocalizedField
              label="Product name"
              value={draft.name}
              errors={{ en: errors['name.en'], id: errors['name.id'] }}
              placeholder={{ en: 'e.g. Virgin Coconut Oil', id: 'mis. Minyak Kelapa Murni' }}
              onChange={(name) => {
                set('name', name)
                if (!slugTouched) set('slug', slugify(name.en))
              }}
            />
            <LocalizedField label="Summary" hint="One or two sentences on the product card." multiline rows={2} value={draft.summary} onChange={(v) => set('summary', v)} />
            <LocalizedField label="Description" hint="The full text on the product page." multiline rows={6} value={draft.description} onChange={(v) => set('description', v)} />
          </FormSection>

          <FormSection
            title="Sizes & SKU codes"
            description="List from smallest to largest. Drag a row to change the order. SKU codes must be unique across all products."
          >
            <div className="flex flex-col gap-2">
              <div className="hidden gap-2 pl-8 pr-10 text-xs font-medium text-stone-500 sm:flex">
                <span className="w-48">SKU code</span>
                <span>Size</span>
              </div>
              <SortableList
                className="flex flex-col gap-2"
                itemClassName="rounded-md"
                items={draft.variants}
                getId={(v) => v.key}
                getLabel={(v) => [v.code, v.size].filter(Boolean).join(' ') || 'New size'}
                onReorder={setVariants}
              >
                {(variant, { handle }) => {
                  const update = (patch: Partial<Variant>) => setVariants(draft.variants.map((v) => (v.key === variant.key ? { ...v, ...patch } : v)))
                  const codeError = errors[`variant.${variant.key}.code`]
                  const sizeError = errors[`variant.${variant.key}.size`]
                  return (
                    <div className="flex items-start gap-2">
                      {handle}
                      <div className="flex w-28 min-w-0 flex-col gap-1 sm:w-48">
                        <input
                          aria-label="SKU code"
                          aria-invalid={codeError ? true : undefined}
                          placeholder="e.g. VCOS"
                          className={`w-full uppercase placeholder:normal-case ${codeError ? invalidInput : ''}`}
                          value={variant.code}
                          onChange={(e) => update({ code: e.target.value.toUpperCase() })}
                        />
                        <FieldError>{codeError}</FieldError>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <input
                          aria-label="Size"
                          aria-invalid={sizeError ? true : undefined}
                          placeholder="e.g. 100 ml"
                          className={`w-full ${sizeError ? invalidInput : ''}`}
                          value={variant.size}
                          onChange={(e) => update({ size: e.target.value })}
                        />
                        <FieldError>{sizeError}</FieldError>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove size"
                        title="Remove size"
                        disabled={draft.variants.length === 1}
                        onClick={() => setVariants(draft.variants.filter((v) => v.key !== variant.key))}
                        className="flex size-[38px] shrink-0 items-center justify-center rounded-md text-stone-400 transition hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-30"
                      >
                        <Icon name="close" size={18} />
                      </button>
                    </div>
                  )
                }}
              </SortableList>
            </div>
            <Button className="w-fit" onClick={() => setVariants([...draft.variants, toRow({ code: '', size: '' })])}>
              <Icon name="plus" size={16} />
              Add size
            </Button>
          </FormSection>
        </div>

        {/* Side column */}
        <div className="flex flex-col gap-5">
          <FormSection title="Visibility">
            <Toggle
              label="Show on website"
              description={draft.is_published ? 'Shown on the website.' : 'Hidden from the website. Only admins can see it.'}
              checked={draft.is_published}
              onChange={(v) => set('is_published', v)}
            />
          </FormSection>

          <FormSection title="Organisation">
            <div className="flex flex-col gap-1.5">
              <Select
                label="Category"
                value={draft.category_slug}
                onChange={(value) => set('category_slug', value)}
                options={categories.map((c, i) => ({ value: c.slug, label: c.name.en, dot: categoryColor(i).dot }))}
              />
              <FieldError>{errors.category}</FieldError>
            </div>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-stone-700">Page address</span>
              <span
                className={`flex items-center overflow-hidden rounded-md border bg-white shadow-xs transition focus-within:ring-2 ${
                  errors.slug ? 'border-red-400 focus-within:ring-red-100' : 'border-stone-300 focus-within:border-brand-600 focus-within:ring-brand-100'
                }`}
              >
                <span className="border-r border-stone-200 bg-stone-50 px-2.5 py-2 text-stone-500">/products/</span>
                <input
                  aria-invalid={errors.slug ? true : undefined}
                  className="min-w-0 flex-1 border-0 shadow-none focus:ring-0"
                  value={draft.slug}
                  placeholder="virgin-coconut-oil"
                  onChange={(e) => {
                    setSlugTouched(true)
                    set('slug', e.target.value.toLowerCase())
                  }}
                />
              </span>
              {errors.slug ? (
                <FieldError>{errors.slug}</FieldError>
              ) : (
                <span className="text-xs text-stone-500">{slugTouched ? 'Lowercase letters, numbers and hyphens.' : 'Filled in from the English name.'}</span>
              )}
            </label>
          </FormSection>

          <FormSection title="Image" description="Square images look best.">
            <ImageUpload folder="products" value={draft.image_url} onChange={(url) => set('image_url', url)} />
          </FormSection>

          {id && (
            <FormSection title="Delete product" description="Removes it from the site. This can’t be undone." className="border-red-200">
              <Button variant="danger" className="w-full" disabled={busy} onClick={deleteProduct}>
                Delete product
              </Button>
            </FormSection>
          )}
        </div>
      </div>
    </form>
  )
}
