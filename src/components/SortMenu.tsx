import { FunctionComponent, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './SortMenu.module.css';
import ArrowIcon from "../assets/icons/contextmenu/Arrow.svg";
import SepIcon from "../assets/icons/contextmenu/sep.svg";

export type SortMenuItem = {
  label: string;
  onClick?: () => void;  // 직접 핸들러 (예: setState)
  href?: string;         // 외부 링크 열기
  newTab?: boolean;      // 링크를 새 탭에서 열지 여부
};

type SortMenuProps = {
  open: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement>;
  items: SortMenuItem[]; // 페이지별로 재사용할 동적 항목
  width?: number;
};

const SortMenu: FunctionComponent<SortMenuProps> = ({ open, onClose, anchorRef, items, width }) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const onDocClick = (e: MouseEvent) => {
      if (anchorRef?.current?.contains(e.target as Node)) return;
      if (!menuRef.current) return;
      // 메뉴 영역 외부 클릭 시 닫기
      if (!menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDocClick);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [anchorRef, open, onClose]);

  if (!open) return null;

  const menuWidth = width ?? 240;
  const style: React.CSSProperties = { position: 'fixed', zIndex: 2000, width: menuWidth };

  if (anchorRef?.current) {
    const r = anchorRef.current.getBoundingClientRect();
    // Clamp within the visible page area (max 430px centered)
    const pageWidth = Math.min(430, window.innerWidth);
    const pageLeft = (window.innerWidth - pageWidth) / 2;
    const pageRight = pageLeft + pageWidth;

    const left = Math.min(
      pageRight - menuWidth - 8,
      Math.max(pageLeft + 8, r.left)
    );
    // 앵커 위로 띄우는 기존 포지셔닝 유지
    style.bottom = window.innerHeight - r.top + 8;
    style.left = left;
  } else {
    style.top = 80;
    style.right = 16;
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
          className={styles.tableViewRow}
          role="menuitem"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
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
    <div
      className={styles.contextMenu}
      style={style}
      ref={menuRef}
      role="menu"
      aria-orientation="vertical"
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((it, i) => renderRow(it, i))}
    </div>,
    document.body
  );
};

export default SortMenu;
