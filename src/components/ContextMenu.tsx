import { FunctionComponent, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import styles from './ContextMenu.module.css';
import ArrowIcon from "../assets/icons/contextmenu/Arrow.svg";
import SepIcon from "../assets/icons/contextmenu/sep.svg";

type ContextMenuProps = {
  open: boolean;
  onClose: () => void;
  onEditTags: () => void;
  anchorRef?: React.RefObject<HTMLElement>;
};

const ContextMenu: FunctionComponent<ContextMenuProps> = ({ open, onClose, onEditTags, anchorRef }) => {
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
      <div className={styles.tableViewRow} onClick={() => { onClose(); navigate('/mobile-list'); }}>
        <div className={styles.tableViewRowLeft}>
          <div className={styles.stack}>
            <div className={styles.title}>현재 등록된 추천작</div>
          </div>
        </div>
        <img className={styles.separator0pt0ptIcon} alt="separator" src={SepIcon} />
        <div className={styles.row}>
          <div className={styles.tableViewRowRight}>
            <div className={styles.arrow}>
              <img className={styles.icon} alt="arrow" src={ArrowIcon} />
            </div>
          </div>
        </div>
      </div>
      <a
        href="https://recom-five.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClose}
        className={styles.tableViewRow}
      >
        <div className={styles.tableViewRowLeft}>
          <div className={styles.stack}>
            <div className={styles.title}>명대사 아카이브</div>
          </div>
        </div>
        <img className={styles.separator0pt0ptIcon} alt="separator" src={SepIcon} />
        <div className={styles.row}>
          <div className={styles.tableViewRowRight}>
            <div className={styles.arrow}>
              <img className={styles.icon} alt="arrow" src={ArrowIcon} />
            </div>
          </div>
        </div>
      </a>
      <button
        type="button"
        onClick={() => { onClose(); onEditTags(); }}
        className={styles.tableViewRow}
      >
        <div className={styles.tableViewRowLeft}>
          <div className={styles.stack}>
            <div className={styles.title}>키워드 수정 요청</div>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.tableViewRowRight}>
            <div className={styles.arrow}>
              <img className={styles.icon} alt="arrow" src={ArrowIcon} />
            </div>
          </div>
        </div>
      </button>
    </div>,
    document.body
  );
};

export default ContextMenu;
