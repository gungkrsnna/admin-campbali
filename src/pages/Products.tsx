import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { Icon } from '../components/icons'
import { Select } from '../components/Select'
import { SortableList } from '../components/Sortable'
import { Thumbnail } from '../components/Thumbnail'
import { Button, EmptyState, ErrorBox, PageHeader, StatusBadge } from '../components/ui'
import { api } from '../lib/api'
import { categoryColor } from '../lib/categoryColors'
import { useReorder } from '../lib/reorder'
import type { Category, Product } from '../lib/types'

export const productsQuery = { queryKey: ['products'], queryFn: () => api<Product[]>('/products') }
export const categoriesQuery = { queryKey: ['categories'], queryFn: () => api<Category[]>('/categories') }

type Status = 'all' | 'visible' | 'hidden'

/** Table columns from md up: drag handle · product · category · sizes · status · edit. */
const columns = 'md:grid-cols-[1.5rem_minmax(0,1fr)_9.5rem_minmax(0,10rem)_6rem_4rem]'

export function Products() {
  const products = useQuery(productsQuery)
  const categories = useQuery(categoriesQuery)
  // Products are saved whole (with variants), so reordering re-sends each moved product.
  const reorder = useReorder<Product>('products', (p) => p.id, (product, sort_order) =>
    api(`/products/${product.id}`, { method: 'PUT', body: { ...product, sort_order } }),
  )

  // Filters live in the URL, so they survive going into a product and coming back.
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const category = params.get('category') ?? 'all'
  const status = (params.get('status') ?? 'all') as Status
  const setFilter = (key: string, value: string, empty: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === empty) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )

  const all = products.data ?? []
  const categoryList = categories.data ?? []
  const categoryIndex = (slug: string) => categoryList.findIndex((c) => c.slug === slug)
  const categoryName = (slug: string) => categoryList.find((c) => c.slug === slug)?.name.en ?? slug

  const needle = query.trim().toLowerCase()
  const visible = all.filter(
    (p) =>
      (category === 'all' || p.category_slug === category) &&
      (status === 'all' || (status === 'visible') === p.is_published) &&
      (!needle || [p.name.en, p.name.id, p.slug, ...p.variants.map((v) => v.code)].some((text) => text.toLowerCase().includes(needle))),
  )
  const filtered = Boolean(needle) || category !== 'all' || status !== 'all'
  const clearFilters = () => setParams({}, { replace: true })

  return (
    <>
      <PageHeader
        title="Products"
        description="The catalogue on the Products page. The order here is the order shown on the site."
        actions={
          <Link
            to="/products/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-brand-800"
          >
            <Icon name="plus" size={16} />
            Add product
          </Link>
        }
      />

      {products.error && <ErrorBox error={products.error} />}

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search products</span>
          <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            placeholder="Search by name or SKU code"
            value={query}
            onChange={(e) => setFilter('q', e.target.value, '')}
            className="w-full pl-10"
          />
        </label>
        <Select
          label="Category"
          hideLabel
          className="sm:w-56"
          value={category}
          onChange={(value) => setFilter('category', value, 'all')}
          options={[
            { value: 'all', label: 'All categories', meta: String(all.length) },
            ...categoryList.map((c, i) => ({
              value: c.slug,
              label: c.name.en,
              dot: categoryColor(i).dot,
              meta: String(all.filter((p) => p.category_slug === c.slug).length),
            })),
          ]}
        />
        <Select<Status>
          label="Status"
          hideLabel
          className="sm:w-44"
          value={status}
          onChange={(value) => setFilter('status', value, 'all')}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'visible', label: 'Visible', dot: 'bg-brand-600' },
            { value: 'hidden', label: 'Hidden', dot: 'bg-stone-400' },
          ]}
        />
      </div>

      {products.isPending ? (
        <ListSkeleton />
      ) : all.length === 0 ? (
        <EmptyState>No products yet. Use Add product to create the first one.</EmptyState>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 py-10 text-center text-sm text-stone-500">
          <p>No products match these filters.</p>
          <Button variant="ghost" className="mt-2 text-brand-700" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xs">
          {/* Column headings. Below md each row stacks instead. */}
          <div
            aria-hidden
            className={`hidden items-center gap-4 border-b border-stone-200 bg-stone-50 px-4 py-2.5 text-xs font-medium tracking-wide text-stone-500 uppercase md:grid ${columns}`}
          >
            <span />
            <span>Product</span>
            <span>Category</span>
            <span>Sizes</span>
            <span>Status</span>
            <span />
          </div>

          <SortableList
            as="ul"
            className="divide-y divide-stone-100"
            itemClassName={`flex items-center gap-3 px-3 py-3 md:grid md:gap-4 md:px-4 ${columns}`}
            items={visible}
            getId={(p) => p.id}
            getLabel={(p) => p.name.en}
            // The order is for the whole catalogue, so it can only change while nothing is filtered out.
            disabled={filtered || reorder.isPending}
            onReorder={(next) => reorder.mutate(next)}
          >
            {(product, { handle }) => {
              const colour = categoryColor(categoryIndex(product.category_slug)).chip
              const categoryChip = (
                <span className={`inline-block max-w-full truncate rounded px-1.5 py-0.5 text-xs font-medium ${colour}`}>{categoryName(product.category_slug)}</span>
              )
              const sizeChips = product.variants.map((v) => (
                <span key={v.code} title={`SKU ${v.code}`} className="rounded border border-stone-200 bg-white px-1.5 py-0.5 text-xs text-stone-600">
                  {v.size}
                </span>
              ))
              return (
                <>
                  {/* An empty cell keeps the columns aligned when the handle is hidden. */}
                  {handle ?? <span className="hidden md:block" />}

                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Thumbnail url={product.image_url} className="size-14 md:size-12" />
                    <div className="min-w-0">
                      <Link to={`/products/${product.id}`} className="block truncate text-sm font-medium text-stone-900 hover:underline">
                        {product.name.en}
                      </Link>
                      <p className="truncate text-xs text-stone-500">{product.name.id}</p>
                      {/* Phone: the other columns stack under the name. */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 md:hidden">
                        <StatusBadge published={product.is_published} />
                        {categoryChip}
                        {sizeChips}
                      </div>
                    </div>
                  </div>

                  <div className="hidden min-w-0 md:block">{categoryChip}</div>
                  <div className="hidden flex-wrap gap-1 md:flex">{sizeChips}</div>
                  <div className="hidden md:block">
                    <StatusBadge published={product.is_published} />
                  </div>

                  <div className="flex justify-end">
                    <Link
                      to={`/products/${product.id}`}
                      className="hidden rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium shadow-xs transition hover:bg-stone-50 md:block"
                    >
                      Edit
                    </Link>
                    <Link to={`/products/${product.id}`} aria-label={`Edit ${product.name.en}`} className="text-stone-400 md:hidden">
                      <Icon name="chevronRight" size={18} />
                    </Link>
                  </div>
                </>
              )
            }}
          </SortableList>

          <p className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 bg-stone-50/60 px-4 py-2.5 text-xs text-stone-500">
            <span>{filtered ? `Showing ${visible.length} of ${all.length} products` : `${all.length} ${all.length === 1 ? 'product' : 'products'}`}</span>
            {filtered ? (
              <span>
                Clear the filters to change the order.{' '}
                <button type="button" onClick={clearFilters} className="font-medium text-brand-700 hover:underline">
                  Clear filters
                </button>
              </span>
            ) : (
              <span>Drag the handle on the left of a row to change the order on the site.</span>
            )}
          </p>
        </div>
      )}
    </>
  )
}

function ListSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white" aria-label="Loading">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <div className="size-12 rounded-md bg-stone-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-48 rounded bg-stone-200" />
            <div className="h-3 w-32 rounded bg-stone-100" />
          </div>
        </div>
      ))}
    </div>
  )
}
