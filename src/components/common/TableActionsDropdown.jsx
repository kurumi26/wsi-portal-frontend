import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { EllipsisVertical } from 'lucide-react';

const toneClasses = {
  default: 'table-actions-dropdown-item table-actions-dropdown-item-default',
  success: 'table-actions-dropdown-item table-actions-dropdown-item-success',
  danger: 'table-actions-dropdown-item table-actions-dropdown-item-danger',
  warning: 'table-actions-dropdown-item table-actions-dropdown-item-warning',
};

export default function TableActionsDropdown({
  items = [],
  ariaLabel = 'Row actions',
  align = 'end',
  buttonClassName = '',
  menuWidth = 240,
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const visibleItems = items.filter((item) => item && item.type !== 'divider' && !item.hidden);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleDocumentClick = (event) => {
      const clickedTrigger = triggerRef.current?.contains(event.target);
      const clickedMenu = menuRef.current?.contains(event.target);

      if (!clickedTrigger && !clickedMenu) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);

    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setMenuStyle(null);
      return undefined;
    }

    const trigger = triggerRef.current;
    const updatePosition = () => {
      const rect = trigger.getBoundingClientRect();
      const left = align === 'start'
        ? rect.left + window.scrollX
        : Math.max(8, rect.right - menuWidth + window.scrollX);
      const top = rect.bottom + 8 + window.scrollY;

      setMenuStyle({
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${menuWidth}px`,
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [align, menuWidth, open]);

  if (!visibleItems.length) {
    return null;
  }

  const renderMenuItem = (item) => {
    if (item.type === 'divider') {
      return <div key={item.key ?? 'divider'} className="my-1 border-t border-slate-200" />;
    }

    const tone = item.tone ?? 'default';
    const itemClassName = `${toneClasses[tone]}${item.disabled ? ' table-actions-dropdown-item-disabled' : ''}`;

    const content = (
      <span className="flex min-w-0 items-center gap-2">
        {item.badge ? (
          <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />
        ) : null}
        <span className="min-w-0 flex-1 whitespace-normal break-words">{item.label}</span>
      </span>
    );

    if (item.to) {
      return (
        <Link
          key={item.key}
          to={item.to}
          className={itemClassName}
          onClick={(event) => {
            item.onClick?.(event);
            setOpen(false);
          }}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        key={item.key}
        type="button"
        disabled={item.disabled}
        className={itemClassName}
        onClick={() => {
          if (item.disabled) {
            return;
          }

          item.onClick?.();
          setOpen(false);
        }}
      >
        {content}
      </button>
    );
  };

  return (
    <div className="relative inline-flex" ref={triggerRef} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] ${buttonClassName}`}
        title="Actions"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <EllipsisVertical size={18} />
      </button>

      {open && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              style={menuStyle}
              role="menu"
              className="table-actions-dropdown-menu rounded-2xl border p-1.5 shadow-xl"
            >
              {items.map((item, index) => renderMenuItem({ ...item, key: item.key ?? `item-${index}` }))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
