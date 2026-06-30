import { FunctionComponent, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import styles from './ContextMenu.module.css';
import ArrowIcon from "../assets/icons/contextmenu/Arrow.svg";
import SepIcon from "../assets/icons/contextmenu/sep.svg";

type ContextMenuProps = {
  open: boolean;
  onClose: () => void;
  onEditTags?: () => void;
  currentPath?: string;
  anchorRef?: React.RefObject<HTMLElement>;
};

type MenuItem = {
  label: string;
  path?: string;
  href?: string;
};

const allItems: MenuItem[] = [
  { label: '키워드 선택하기', path: '/mobile-index' },
  { label: '현재 등록된 추천작', path: '/mobile-list' },
  { label: '명대사 아카이브', href: 'https://recom-five.vercel.app/' },
];

const ContextMenu: FunctionComponent<ContextMenuProps> = ({ open, onClose, currentPath, anchorRef }) => {
	const navigate = useNavigate();

  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const items = allItems.filter((item) => item.path !== currentPath);

  const MENU_WIDTH = 240; // px
  const style: React.CSSProperties = { position: 'fixed', zIndex: 2000, width: MENU_WIDTH };
  if (anchorRef?.current) {
    const r = anchorRef.current.getBoundingClientRect();
    const left = Math.min(
      window.innerWidth - MENU_WIDTH - 8,
      Math.max(8, r.right - MENU_WIDTH)
    );
    style.top = r.bottom + 8;
    style.left = left;
  } else {
    style.top = 80;
    (style as any).right = 16;
  }

  return createPortal(
    <div className={styles.contextMenu} style={style} ref={menuRef} role="menu" aria-orientation="vertical">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        const content = (
          <>
            <div className={styles.tableViewRowLeft}>
              <div className={styles.stack}>
                <div className={styles.title}>{item.label}</div>
              </div>
            </div>
            {!isLast && <img className={styles.separator0pt0ptIcon} alt="separator" src={SepIcon} />}
            <div className={styles.row}>
              <div className={styles.tableViewRowRight}>
                <div className={styles.arrow}>
                  <img className={styles.icon} alt="arrow" src={ArrowIcon} />
                </div>
              </div>
            </div>
          </>
        );

        if (item.href) {
          return (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className={styles.tableViewRow}
            >
              {content}
            </a>
          );
        }

        return (
          <div
            key={item.label}
            className={styles.tableViewRow}
            onClick={() => { onClose(); navigate(item.path!); }}
          >
            {content}
          </div>
        );
      })}
    </div>,
    document.body
  );
};

export default ContextMenu;
