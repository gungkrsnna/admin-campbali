import { Label, Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { Icon } from './icons'

export type SelectOption<V extends string> = {
  value: V
  label: string
  /** Optional colour dot (a Tailwind bg-* class) shown before the label. */
  dot?: string
  /** Optional small grey text at the end of the option, e.g. a count. */
  meta?: string
}

/**
 * The admin's dropdown, used instead of the browser's native <select>.
 * Headless UI provides the keyboard and screen-reader behaviour; the look is ours.
 */
export function Select<V extends string>({
  label,
  hideLabel = false,
  value,
  options,
  onChange,
  className = '',
}: {
  label: string
  hideLabel?: boolean
  value: V
  options: SelectOption<V>[]
  onChange: (value: V) => void
  className?: string
}) {
  const selected = options.find((o) => o.value === value)

  return (
    <Listbox value={value} onChange={onChange}>
      <div className={`flex flex-col gap-1.5 text-sm ${className}`}>
        <Label className={hideLabel ? 'sr-only' : 'font-medium text-stone-700'}>{label}</Label>
        <ListboxButton className="group flex h-[38px] w-full items-center gap-2 rounded-md border border-stone-300 bg-white px-3 text-left text-sm shadow-xs transition outline-none hover:border-stone-400 focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-100 data-open:border-brand-600 data-open:ring-2 data-open:ring-brand-100">
          {selected?.dot && <span aria-hidden className={`size-2 shrink-0 rounded-full ${selected.dot}`} />}
          <span className="min-w-0 flex-1 truncate text-stone-800">{selected?.label ?? 'Choose…'}</span>
          <Icon name="chevronDown" size={16} className="shrink-0 text-stone-400 transition group-data-open:rotate-180" />
        </ListboxButton>
      </div>

      <ListboxOptions
        anchor={{ to: 'bottom start', gap: 6 }}
        transition
        className="z-50 w-(--button-width) min-w-44 rounded-lg border border-stone-200 bg-white p-1 shadow-lg outline-none transition duration-100 ease-out [--anchor-max-height:18rem] data-closed:-translate-y-1 data-closed:opacity-0"
      >
        {options.map((option) => (
          <ListboxOption
            key={option.value}
            value={option.value}
            className="group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-stone-700 select-none data-focus:bg-stone-100 data-selected:font-medium data-selected:text-stone-900"
          >
            {option.dot && <span aria-hidden className={`size-2 shrink-0 rounded-full ${option.dot}`} />}
            <span className="flex-1 truncate">{option.label}</span>
            {option.meta && <span className="text-xs text-stone-400 tabular-nums">{option.meta}</span>}
            <Icon name="tick" size={16} className="invisible shrink-0 text-brand-700 group-data-selected:visible" />
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  )
}
