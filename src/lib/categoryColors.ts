/** Category colours, assigned by the category's position in the category list. */
const palette = [
  { chip: 'bg-brand-50 text-brand-700', dot: 'bg-brand-600' },
  { chip: 'bg-teal-50 text-teal-700', dot: 'bg-teal-500' },
  { chip: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
  { chip: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  { chip: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
]

export function categoryColor(index: number) {
  return palette[Math.max(0, index) % palette.length]
}
