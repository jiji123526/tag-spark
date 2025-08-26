import { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import styles from './WebLanding.module.css';

// Import assets (SVGs) from src/assets
import wallpaperLight from '../assets/Light-mode.svg';
import appsInDock from '../assets/Apps in Dock.svg';
import statusBar from '../assets/Status Bar.svg';
import appStorePopup from '../assets/AppStore.svg';

const WebLanding: FunctionComponent = () => {
  return (
    <div className={styles.WebLanding}>
      <img className={styles.wallpapersWebLandingIcon} alt="" src={wallpaperLight} />
      <img className={styles.dock} alt="Dock" src={appsInDock} />
      <img className={styles.statusBar} alt="Status Bar" src={statusBar} />
      <div className={styles.popupWrapper}>
        <Link to="/index">
          <img className={styles.appStorePopup} alt="App Store Popup" src={appStorePopup} />
        </Link>
      </div>
    </div>
  );
};

export default WebLanding;
