import React from 'react'
import { cn } from './utils'
import { Skeleton } from './Skeleton'

/**
 * Table primitives (header style from the dashboard mock: muted 12.5px
 * labels on surface-2, rows separated by soft hairlines). Wrap in <Card padding="none">.
 *
 *   <Table minWidth={600}>
 *     <THead><TR><TH>الحملة</TH><TH>الحالة</TH></TR></THead>
 *     <TBody><TR><TD>…</TD><TD><StatusPill status="sending">قيد الإرسال</StatusPill></TD></TR></TBody>
 *   </Table>
 */
export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Minimum table width before horizontal scrolling kicks in (px). */
  minWidth?: number
  /** Classes for the scroll wrapper. */
  wrapperClassName?: string
  /** Visually hidden caption (recommended for screen readers). */
  caption?: string
  dense?: boolean
}

const DenseContext = React.createContext(false)

export function Table({ minWidth = 600, wrapperClassName, caption, dense = false, className, children, ...rest }: TableProps) {
  return (
    <DenseContext.Provider value={dense}>
      <div className={cn('w-full overflow-x-auto', wrapperClassName)}>
        <table className={cn('w-full border-collapse text-sm', className)} style={{ minWidth }} {...rest}>
          {caption && <caption className="sr-only">{caption}</caption>}
          {children}
        </table>
      </div>
    </DenseContext.Provider>
  )
}

export function THead({ className, ...rest }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('text-[12.5px] text-muted', className)} {...rest} />
}

export function TBody({ className, ...rest }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...rest} />
}

export interface TRProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Hover highlight + pointer (for clickable rows). */
  interactive?: boolean
  selected?: boolean
}

export function TR({ interactive, selected, className, ...rest }: TRProps) {
  return <tr className={cn('transition-colors', interactive && 'cursor-pointer hover:bg-surface-2', selected && 'bg-chip/50', className)} aria-selected={selected || undefined} {...rest} />
}

export interface THProps extends Omit<React.ThHTMLAttributes<HTMLTableCellElement>, "align"> {
  align?: 'start' | 'center' | 'end'
}

export function TH({ align = 'start', className, scope = 'col', ...rest }: THProps) {
  const dense = React.useContext(DenseContext)
  return (
    <th
      scope={scope}
      className={cn(
        'whitespace-nowrap bg-surface-2 font-medium',
        dense ? 'px-3 py-2' : 'px-4 py-[11px] sm:px-[22px]',
        align === 'start' && 'text-start', align === 'center' && 'text-center', align === 'end' && 'text-end',
        className,
      )}
      {...rest}
    />
  )
}

export interface TDProps extends Omit<React.TdHTMLAttributes<HTMLTableCellElement>, "align"> {
  align?: 'start' | 'center' | 'end'
  /** Secondary muted text below the main content. */
  sub?: React.ReactNode
}

export function TD({ align = 'start', sub, className, children, ...rest }: TDProps) {
  const dense = React.useContext(DenseContext)
  return (
    <td
      className={cn(
        'border-t border-line-soft align-middle text-ink',
        dense ? 'px-3 py-2.5' : 'px-4 py-3.5 sm:px-[22px]',
        align === 'start' && 'text-start', align === 'center' && 'text-center', align === 'end' && 'text-end',
        className,
      )}
      {...rest}
    >
      {sub ? (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{children}</span>
          <span className="text-xs text-muted">{sub}</span>
        </div>
      ) : children}
    </td>
  )
}

/* ── DataTable: columns config on top of the primitives ───── */

export interface Column<T> {
  key: string
  header: React.ReactNode
  /** Cell renderer; defaults to row[key]. */
  cell?: (row: T, index: number) => React.ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
  headerClassName?: string
  /** Hide below this breakpoint. */
  hideBelow?: 'sm' | 'md' | 'lg'
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T, index: number) => string | number
  loading?: boolean
  /** Number of skeleton rows while loading. */
  skeletonRows?: number
  /** Rendered when rows is empty (use <EmptyState/>). */
  empty?: React.ReactNode
  onRowClick?: (row: T) => void
  minWidth?: number
  caption?: string
  dense?: boolean
  className?: string
}

const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' }

export function DataTable<T>({ columns, rows, rowKey, loading, skeletonRows = 4, empty, onRowClick, minWidth, caption, dense, className }: DataTableProps<T>) {
  const list = rows || []
  return (
    <Table minWidth={minWidth} caption={caption} dense={dense} className={className} aria-busy={loading || undefined}>
      <THead>
        <TR>
          {columns.map(c => (
            <TH key={c.key} align={c.align} className={cn(c.hideBelow && hide[c.hideBelow], c.headerClassName)}>{c.header}</TH>
          ))}
        </TR>
      </THead>
      <TBody>
        {loading && !list.length
          ? Array.from({ length: skeletonRows }, (_, i) => (
              <TR key={`s${i}`}>
                {columns.map(c => <TD key={c.key} className={cn(c.hideBelow && hide[c.hideBelow])}><Skeleton className="h-4 w-3/4" /></TD>)}
              </TR>
            ))
          : list.length === 0 && empty
            ? <tr><td colSpan={columns.length} className="border-t border-line-soft">{empty}</td></tr>
            : list.map((row, i) => (
                <TR
                  key={rowKey(row, i)}
                  interactive={!!onRowClick}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row) } : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {columns.map(c => (
                    <TD key={c.key} align={c.align} className={cn(c.hideBelow && hide[c.hideBelow], c.className)}>
                      {c.cell ? c.cell(row, i) : (row as Record<string, React.ReactNode>)[c.key]}
                    </TD>
                  ))}
                </TR>
              ))}
      </TBody>
    </Table>
  )
}

export default Table
