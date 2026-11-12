import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useConfirm } from '../components/ConfirmDialog'
import { Icon } from '../components/icons'
import { Button, ErrorBox, Loading, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { env } from '../lib/env'
import { areaInfo, changeLink, changeTitle, kindLabel, usePublish, usePublishStatus, type Change, type Release } from '../lib/publish'
import { formatDateTime, timeAgo } from '../lib/time'

const kindStyle: Record<Change['kind'], string> = {
  added: 'bg-brand-50 text-brand-700',
  edited: 'bg-amber-50 text-amber-800',
  removed: 'bg-red-50 text-red-700',
  reordered: 'bg-stone-100 text-stone-700',
}

const areaOrder: Change['area'][] = ['page', 'product', 'category', 'testimonial', 'faq', 'milestone', 'settings']

/** Everything saved since the last publish, and the button that puts it on the website. */
export function Publish() {
  const status = usePublishStatus()
  const publish = usePublish()
  const confirm = useConfirm()
  const history = useQuery({ queryKey: ['releases'], queryFn: () => api<Release[]>('/publish/history') })

  if (status.isPending) return <Loading />
  if (status.error) return <ErrorBox error={status.error} />

  const { lastPublished, changes } = status.data
  const firstPublish = !lastPublished
  const count = changes.length
  const ready = firstPublish || count > 0

  async function onPublish() {
    const ok = await confirm({
      title: firstPublish ? 'Publish the website?' : `Publish ${count} ${count === 1 ? 'change' : 'changes'}?`,
      message: firstPublish
        ? 'The website will switch from its built-in content to the content managed in this admin.'
        : 'Visitors will see these changes straight away.',
      confirmLabel: 'Publish',
    })
    if (ok) publish.mutate()
  }

  const groups = areaOrder
    .map((area) => ({ area, items: changes.filter((c) => c.area === area) }))
    .filter((g) => g.items.length > 0)

  return (
    <>
      <PageHeader
        title="Publish"
        description="Saving only changes the draft. The website keeps showing the last published version until you publish."
        actions={
          <Button variant="primary" disabled={!ready || publish.isPending} onClick={onPublish}>
            <Icon name="publish" size={16} />
            {publish.isPending ? 'Publishing…' : 'Publish'}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xs">
            <div className={`flex items-center gap-3 border-b px-5 py-4 ${ready ? 'border-amber-100 bg-amber-50' : 'border-brand-100 bg-brand-50'}`}>
              <Icon name={ready ? 'clock' : 'check'} className={ready ? 'text-amber-600' : 'text-brand-600'} />
              <div>
                <h2 className="text-sm font-semibold text-stone-900">
                  {firstPublish
                    ? 'Not published yet'
                    : count
                      ? `${count} ${count === 1 ? 'change is' : 'changes are'} waiting`
                      : 'The website is up to date'}
                </h2>
                <p className="text-xs text-stone-600">
                  {firstPublish
                    ? 'The website shows its built-in content until the first publish.'
                    : count
                      ? 'Saved in the admin, not on the website yet.'
                      : 'Everything you saved is on the website.'}
                </p>
              </div>
            </div>

            {!firstPublish && count > 0 && (
              <div className="divide-y divide-stone-100">
                {groups.map(({ area, items }) => (
                  <section key={area} className="px-5 py-4">
                    <h3 className="mb-2 text-xs font-medium tracking-wide text-stone-500 uppercase">{areaInfo[area].title}</h3>
                    <ul className="flex flex-col gap-1">
                      {items.map((change, i) => (
                        <li key={`${change.label}-${change.kind}-${i}`}>
                          <ChangeRow change={change} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>

          {ready && (
            <p className="mt-3 text-sm text-stone-500">
              Want to check first? The{' '}
              <Link to="/pages" className="font-medium text-brand-700 hover:underline">
                Site Editor
              </Link>{' '}
              shows every page with your saved changes, before they are published.
            </p>
          )}
        </div>

        <div className="h-fit overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xs">
          <h2 className="border-b border-stone-100 px-5 py-3 text-sm font-semibold text-stone-800">Recently published</h2>
          {history.data?.length ? (
            <ul className="divide-y divide-stone-100">
              {history.data.map((release, i) => (
                <li key={release.id} className="px-5 py-3">
                  <p className="text-sm text-stone-800">
                    <time dateTime={release.created_at} title={formatDateTime(release.created_at)}>
                      {timeAgo(release.created_at)}
                    </time>
                    {i === 0 && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Live</span>}
                  </p>
                  <p className="truncate text-xs text-stone-500">{release.published_by_email ?? 'Unknown'}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-stone-500">{history.isPending ? 'Loading…' : 'Nothing published yet.'}</p>
          )}
          {env.siteUrl && (
            <a
              href={env.siteUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 border-t border-stone-100 px-5 py-3 text-sm text-stone-600 transition hover:bg-stone-50 hover:text-stone-900"
            >
              <Icon name="external" size={16} />
              View the website
            </a>
          )}
        </div>
      </div>
    </>
  )
}

function ChangeRow({ change }: { change: Change }) {
  const removed = change.kind === 'removed'
  const body = (
    <>
      <span className={`w-20 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-medium ${kindStyle[change.kind]}`}>{kindLabel[change.kind]}</span>
      <span className={`min-w-0 flex-1 truncate text-sm ${removed ? 'text-stone-500 line-through' : 'text-stone-800'}`}>{changeTitle(change)}</span>
    </>
  )
  if (removed) return <div className="flex items-center gap-3 rounded-md px-2 py-1.5">{body}</div>
  return (
    <Link to={changeLink(change)} className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-stone-50">
      {body}
      <Icon name="chevronRight" size={16} className="text-stone-300 group-hover:text-stone-500" />
    </Link>
  )
}
