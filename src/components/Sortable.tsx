import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'

type ItemState = { handle: ReactNode; isDragging: boolean }

/**
 * A vertical list the user reorders by dragging each row's handle (mouse, touch, or keyboard:
 * focus the handle, Space to pick up, arrow keys to move, Space to drop).
 * `onReorder` receives the whole list in its new order.
 */
export function SortableList<T>({
  items,
  getId,
  getLabel,
  onReorder,
  disabled = false,
  as: Tag = 'div',
  className,
  itemClassName = '',
  children,
}: {
  items: T[]
  getId: (item: T) => string
  /** Spoken to screen-reader users while dragging. */
  getLabel: (item: T) => string
  onReorder: (items: T[]) => void
  disabled?: boolean
  as?: 'div' | 'ul'
  className?: string
  itemClassName?: string
  children: (item: T, state: ItemState) => ReactNode
}) {
  const sensors = useSensors(
    // A few pixels of movement before a drag starts, so clicks on the handle stay clicks.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const ids = items.map(getId)
  const labelOf = (id: string | number) => {
    const item = items.find((i) => getId(i) === id)
    return item ? getLabel(item) : 'Item'
  }
  const positionOf = (id: string | number) => ids.indexOf(String(id)) + 1

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${labelOf(active.id)}. Position ${positionOf(active.id)} of ${ids.length}.`,
    onDragOver: ({ active, over }) => (over ? `${labelOf(active.id)} moved to position ${positionOf(over.id)} of ${ids.length}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `${labelOf(active.id)} dropped at position ${positionOf(over.id)} of ${ids.length}.` : `${labelOf(active.id)} dropped.`),
    onDragCancel: ({ active }) => `Moving ${labelOf(active.id)} was cancelled.`,
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    onReorder(arrayMove(items, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: 'To reorder, press Space to pick up the item, use the arrow keys to move it, then press Space again to drop it. Press Escape to cancel.' },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
        <Tag className={className}>
          {items.map((item) => (
            <SortableItem key={getId(item)} id={getId(item)} label={getLabel(item)} disabled={disabled} as={Tag === 'ul' ? 'li' : 'div'} className={itemClassName}>
              {(state) => children(item, state)}
            </SortableItem>
          ))}
        </Tag>
      </SortableContext>
    </DndContext>
  )
}

function SortableItem({
  id,
  label,
  disabled,
  as: Tag,
  className,
  children,
}: {
  id: string
  label: string
  disabled: boolean
  as: 'div' | 'li'
  className: string
  children: (state: ItemState) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  const handle = disabled ? null : <DragHandle ref={setActivatorNodeRef} attributes={attributes} listeners={listeners} label={label} />
  return (
    <Tag
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${className} ${isDragging ? 'relative z-10 bg-white shadow-lg ring-1 ring-stone-200' : ''}`}
    >
      {children({ handle, isDragging })}
    </Tag>
  )
}

function DragHandle({
  ref,
  attributes,
  listeners,
  label,
}: {
  ref: (element: HTMLElement | null) => void
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
  label: string
}) {
  return (
    <button
      ref={ref}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`Drag to reorder ${label}`}
      title="Drag to reorder"
      className="flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:outline-none active:cursor-grabbing"
    >
      <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden>
        {[3, 9, 15].flatMap((y) => [<circle key={`l${y}`} cx="3" cy={y} r="1.5" />, <circle key={`r${y}`} cx="9" cy={y} r="1.5" />])}
      </svg>
    </button>
  )
}
