import { FunctionComponent, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import styles from './SortMenu.module.css';
import ArrowIcon from "../assets/contextmenu/Arrow.svg";
import SepIcon from "../assets/contextmenu/sep.svg";

export type SortMenuItem = {
  label: string;
  onClick?: () => void; // used when you want a direct handler (e.g., setState)
  href?: string;        // used when you want to open a link
  newTab?: boolean;     // open in a new tab when href is used
};

type SortMenuProps = {
  open: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement>;
  items: SortMenuItem[]; // dynamic items to reuse across pages
};

const SortMenu: FunctionComponent<SortMenuProps> = ({ open, onClose, anchorRef, items }) => {
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onDocClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onDocClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  const MENU_WIDTH = 240; // px
  const style: React.CSSProperties = { position: 'fixed', zIndex: 2000, width: MENU_WIDTH };
  if (anchorRef?.current) {
    const r = anchorRef.current.getBoundingClientRect();
    const left = Math.min(
      window.innerWidth - MENU_WIDTH - 8,
      Math.max(8, r.right - MENU_WIDTH)
    );
    style.bottom = window.innerHeight - r.top + 8;
    style.left = left;
  } else {
    style.top = 80;
    (style as any).right = 16;
  }

  const RowLeft = ({ label }: { label: string }) => (
    <div className={styles.tableViewRowLeft}>
      <div className={styles.stack}>
        <div className={styles.title}>{label}</div>
      </div>
    </div>
  );

  const Arrow = () => (
    <div className={styles.row}>
      <div className={styles.tableViewRowRight}>
        <div className={styles.arrow}>
          <img className={styles.icon} alt="arrow" src={ArrowIcon} />
        </div>
      </div>
    </div>
  );

  const renderRow = (item: SortMenuItem, idx: number) => {
    const isLast = idx === items.length - 1;
    const common = (
      <>
        <RowLeft label={item.label} />
        {!isLast && (
          <img className={styles.separator0pt0ptIcon} alt="separator" src={SepIcon} />
        )}
        <Arrow />
      </>
    );

    if (item.href) {
      return (
        <a
          key={idx}
          href={item.href}
          target={item.newTab ? '_blank' : undefined}
          rel={item.newTab ? 'noopener noreferrer' : undefined}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className={styles.tableViewRow}
          role="menuitem"
        >
          {common}
        </a>
      );
    }

    return (
      <div
        key={idx}
        className={styles.tableViewRow}
        role="menuitem"
        onClick={(e) => {
          e.stopPropagation();
          if (item.onClick) item.onClick();
          onClose();
        }}
      >
        {common}
      </div>
    );
  };

  return createPortal(
    <div className={styles.contextMenu} style={style} ref={menuRef} role="menu" aria-orientation="vertical" onClick={(e) => e.stopPropagation()}>
      {items.map((it, i) => renderRow(it, i))}
    </div>,
    document.body
  );
};

export default SortMenu;
