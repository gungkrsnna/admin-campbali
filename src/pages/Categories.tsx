import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useConfirm } from '../components/ConfirmDialog'
import { Icon } from '../components/icons'
import { SortableList } from '../components/Sortable'
import { useToast } from '../components/Toast'
import { Button, ErrorBox, FieldError, invalidInput, Loading, LocalizedField, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { categoryColor } from '../lib/categoryColors'
import { nextSortOrder, useReorder } from '../lib/reorder'
import { emptyLocalized, type Category } from '../lib/types'
import { useUnsavedChanges } from '../lib/useUnsavedChanges'
import { categoriesQuery, productsQuery } from './Products'
import { DELETED_AS_DRAFT, SAVED_AS_DRAFT } from '../lib/publish'

type Draft = Pick<Category, 'slug' | 'name' | 'sort_order'>
/** `original` is the slug before editing (null for a new category), since the slug itself can be renamed. */
type Editing = { original: string | null; baseline: Draft; draft: Draft }
type Errors = Record<string, string>

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

function validate(editing: Editing, all: Category[]): Errors {
  const { draft, original } = editing
  const errors: Errors = {}
  if (!draft.name.en.trim()) errors['name.en'] = 'Enter the English name.'
  if (!draft.name.id.trim()) errors['name.id'] = 'Enter the Indonesian name.'
  if (!draft.slug) errors.slug = 'Enter a short code.'
  else if (!SLUG.test(draft.slug)) errors.slug = 'Use lowercase letters, numbers and single hyphens only.'
  else if (all.some((c) => c.slug === draft.slug && c.slug !== original)) errors.slug = 'Another category already uses this code.'
  return errors
}

export function Categories() {
  const categories = useQuery(categoriesQuery)
  const products = useQuery(productsQuery)
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)
  const reorder = useReorder<Category>('categories', (c) => c.slug)

  const items = categories.data ?? []
  const productCount = (slug: string) => products.data?.filter((p) => p.category_slug === slug).length ?? 0
  const dirty = editing !== null && JSON.stringify(editing.draft) !== JSON.stringify(editing.baseline)
  const errors = editing && submitted ? validate(editing, items) : {}
  useUnsavedChanges(dirty)

  const open = (original: string | null, draft: Draft) => {
    setSubmitted(false)
    setSlugTouched(original !== null)
    setEditing({ original, baseline: draft, draft: structuredClone(draft) })
  }
  const close = () => {
    setEditing(null)
    setSubmitted(false)
  }
  const setDraft = (patch: Partial<Draft>) => editing && setEditing({ ...editing, draft: { ...editing.draft, ...patch } })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
  }

  const save = useMutation({
    mutationFn: ({ original, draft }: Editing) =>
      original ? api(`/categories/${original}`, { method: 'PATCH', body: draft }) : api('/categories', { method: 'POST', body: draft }),
    onSuccess: () => {
      toast.success(SAVED_AS_DRAFT)
      close()
      refresh()
    },
    onError: toast.error,
  })

  const remove = useMutation({
    mutationFn: (slug: string) => api(`/categories/${slug}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(DELETED_AS_DRAFT)
      close()
      refresh()
    },
    onError: toast.error,
  })

  function submit() {
    if (!editing) return
    setSubmitted(true)
    if (Object.keys(validate(editing, items)).length) {
      toast.error('Some fields need attention.')
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    save.mutate(editing)
  }

  async function cancel() {
    if (dirty && !(await confirm({ title: 'Discard changes?', message: 'What you changed in this form will be lost.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', tone: 'danger' }))) return
    close()
  }

  async function deleteCategory(slug: string, name: string) {
    if (await confirm({ title: `Delete ${name}?`, message: 'The category will be removed. This can’t be undone.', confirmLabel: 'Delete category', tone: 'danger' })) remove.mutate(slug)
  }

  const busy = save.isPending || remove.isPending

  const form = editing && (
    <form
      noValidate
      className="rounded-lg border border-brand-600/30 bg-white shadow-sm ring-4 ring-brand-50"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <header className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-stone-900">{editing.original ? 'Edit category' : 'New category'}</h2>
        {dirty && (
          <span className="flex items-center gap-1.5 text-xs text-amber-700">
            <span className="size-1.5 rounded-full bg-amber-500" />
            Unsaved changes
          </span>
        )}
      </header>

      <div className="flex flex-col gap-5 p-5">
        <LocalizedField
          label="Category name"
          value={editing.draft.name}
          errors={{ en: errors['name.en'], id: errors['name.id'] }}
          placeholder={{ en: 'e.g. Cold-Pressed Oils', id: 'mis. Minyak Cold-Pressed' }}
          onChange={(name) => setDraft(slugTouched ? { name } : { name, slug: slugify(name.en) })}
        />
        <label className="flex flex-col gap-1.5 text-sm sm:max-w-sm">
          <span className="font-medium text-stone-700">Short code</span>
          <input
            aria-invalid={errors.slug ? true : undefined}
            className={errors.slug ? invalidInput : ''}
            placeholder="e.g. oils"
            value={editing.draft.slug}
            onChange={(e) => {
              setSlugTouched(true)
              setDraft({ slug: e.target.value.toLowerCase() })
            }}
          />
          {errors.slug ? (
            <FieldError>{errors.slug}</FieldError>
          ) : (
            <span className="text-xs text-stone-500">
              Used inside the system. Lowercase letters, numbers and hyphens.
              {editing.original && ' Changing it also updates the products in this category.'}
            </span>
          )}
        </label>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-stone-100 px-5 py-3.5">
        <Button type="submit" variant="primary" disabled={busy || (editing.original !== null && !dirty)}>
          {save.isPending ? 'Saving…' : editing.original ? 'Save' : 'Add category'}
        </Button>
        <Button onClick={cancel} disabled={busy}>
          Cancel
        </Button>
        {editing.original &&
          (productCount(editing.original) > 0 ? (
            <span className="ml-auto text-xs text-stone-500">
              Has {productCount(editing.original)} {productCount(editing.original) === 1 ? 'product' : 'products'}, so it can’t be deleted.
            </span>
          ) : (
            <Button variant="danger" className="ml-auto" disabled={busy} onClick={() => deleteCategory(editing.original!, editing.baseline.name.en)}>
              Delete
            </Button>
          ))}
      </footer>
    </form>
  )

  return (
    <>
      <PageHeader
        title="Categories"
        description="How products are grouped. A category that still has products can’t be deleted."
        actions={
          <Button variant="primary" disabled={editing !== null} onClick={() => open(null, { slug: '', name: emptyLocalized(), sort_order: nextSortOrder(items) })}>
            <Icon name="plus" size={16} />
            Add category
          </Button>
        }
      />
      {categories.isPending && <Loading />}
      {categories.error && <ErrorBox error={categories.error} />}
      {editing?.original === null && <div className="mb-4">{form}</div>}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xs">
          <SortableList
            as="ul"
            className="divide-y divide-stone-100"
            items={items}
            getId={(c) => c.slug}
            getLabel={(c) => c.name.en}
            disabled={editing !== null || reorder.isPending}
            onReorder={(next) => reorder.mutate(next)}
          >
            {(category, { handle }) => {
              if (editing?.original === category.slug) return <div className="bg-stone-50 p-3 sm:p-4">{form}</div>
              const count = productCount(category.slug)
              return (
                <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
                  {handle ?? <span className="w-6 shrink-0" />}
                  <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${categoryColor(items.indexOf(category)).dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-900">{category.name.en}</p>
                    <p className="truncate text-xs text-stone-500">{category.name.id}</p>
                  </div>
                  <span className="hidden rounded bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-600 sm:inline">{category.slug}</span>
                  <span className="w-20 text-right text-xs text-stone-500 tabular-nums">
                    {count} {count === 1 ? 'product' : 'products'}
                  </span>
                  <Button disabled={editing !== null} onClick={() => open(category.slug, { slug: category.slug, name: category.name, sort_order: category.sort_order })} className="py-1.5">
                    Edit
                  </Button>
                </div>
              )
            }}
          </SortableList>
          <p className="border-t border-stone-100 bg-stone-50/60 px-4 py-2.5 text-xs text-stone-500">
            The order here is the order of the categories on the Products page. Drag a row to change it.
          </p>
        </div>
      )}
    </>
  )
}
