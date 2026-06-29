import { FunctionComponent } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MobileLanding.module.css';
import wallpaper from "../assets/images/Wallpaper.png";
import flashlight from "../assets/icons/Flashlight.svg";
import camera from "../assets/icons/Camera.svg";
import mobileSignal from "../assets/icons/Mobile Signal.svg";
import wifi from "../assets/icons/Wifi.svg";
import outline from "../assets/icons/_StatusBar-battery.svg";
import batteryEnd from "../assets/illustrations/_LockScreen-widget.svg";
import fill from "../assets/icons/moon.fill.svg";
import imagePng from "../assets/images/Image.png";
import closeSvg from "../assets/icons/Close.svg";
import appclipIcon from "../assets/illustrations/_AppClip-icon.svg";
import logoSvg from "../assets/illustrations/Logo.svg";
import chevronForward from "../assets/icons/chevron.forward.svg";


const MobileLanding:FunctionComponent = () => {
  const navigate = useNavigate();
  const handleOpen = () => {
    navigate("/onboarding");
  };
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpen();
    }
  };
  	return (
    		<div className={styles.Landing}>
      			<div className={styles.lockscreen}>
        				<div className={styles.iphone14Wallpaper}>
          					<img className={styles.wallpaperIcon} alt="" src={wallpaper} />
        				</div>
        				<div className={styles.bottomActions}>
          					<img className={styles.flashlightIcon} alt="" src={flashlight} />
          					{/* <div className={styles.focus}>
            						<img className={styles.sfSymbolMoonfill} alt="" src="SF Symbol / moon.fill.svg" />
            						<div className={styles.doNotDisturb}>Do Not Disturb</div>
          					</div> */}
          					<img className={styles.flashlightIcon} alt="" src={camera} />
        				</div>
        				<div className={styles.homeindicator}>
          					<div className={styles.homeIndicator} />
        				</div>
        				<div className={styles.statusBarTimeWidgets}>
          					<div className={styles.widgets}>
          					</div>
          					<div className={styles.statusBarTimeDate}>
            						<div className={styles.statusbar}>
              							<div className={styles.leftSide}>
                								<div className={styles.statusbarTime}>
                  									<div className={styles.time1}>5:12</div>
                								</div>
              							</div>
              							<div className={styles.dynamicIsland}>
                								<div className={styles.statusbarDynamicisland}>
                  									<div className={styles.truedepthCamera} />
                  									<div className={styles.facetimeCamera} />
                								</div>
              							</div>
              							<div className={styles.rightSide}>
                								<div className={styles.signalWifiBattery}>
                  									<img className={styles.iconMobileSignal} alt="" src={mobileSignal} />
                  									<img className={styles.wifiIcon} alt="" src={wifi} />
                  									<div className={styles.statusbarBattery}>
                    										<img className={styles.outlineIcon} alt="" src={outline} />
                    										<img className={styles.batteryEndIcon} alt="" src={batteryEnd} />
                    										<img className={styles.fillIcon} alt="" src={fill} />
                  									</div>
                								</div>
              							</div>
            						</div>
            						<div className={styles.date}>Friday, May 12</div>
            						<div className={styles.time2}>5:12</div>
          					</div>
        				</div>
      			</div>
      			<div className={styles.appclip}>
        				<div className={styles.image}>
          					<img className={styles.imageIcon} alt="" src={imagePng} />
          					<img className={styles.closeIcon} alt="" src={closeSvg} />
        				</div>
        				<div className={styles.nameDescOpenButton}>
          					<div className={styles.button} onClick={handleOpen} onKeyDown={handleKey} role="button" tabIndex={0}>
            						<div className={styles.label}>Open</div>
          					</div>
          					<div className={styles.nameDesc}>
            						<b className={styles.clipName}>오늘은 뭘 읽을까?</b>
            						<div className={styles.heresAPlace}>키워드를 선택해서 <br/>취향에 맞는 포타를 추천받으세요.</div>
          					</div>
          					<div className={styles.separator} />
          					<div className={styles.poweredBy}>
            						<img className={styles.appclipIcon} alt="" src={appclipIcon} />
            						<div className={styles.poweredBy1}>
              							<div className={styles.poweredBy2}>Only For</div>
              							<div className={styles.appName}>JMJ</div>
            						</div>
          					</div>
          					<div className={styles.appStore}>
            						<img className={styles.logoIcon} alt="" src={logoSvg} />
            						<div className={styles.appStore1}>App Store</div>
            						<img className={styles.sfIconChevronforward} alt="" src={chevronForward} />
          					</div>
        				</div>
      			</div>
    		</div>);
};

export default MobileLanding;
