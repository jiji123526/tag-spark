import { FunctionComponent, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Onboarding.module.css';

import TailIcon from "../assets/icons/onboarding/Tail.svg";
import Tail1Icon from "../assets/icons/onboarding/Tail-1.svg";
import AvatarIcon from "../assets/icons/onboarding/Avatar.svg";
import ChevronIcon from "../assets/icons/onboarding/Chevron.svg";
import BackIcon from "../assets/icons/onboarding/Back.svg";
import PlusIcon from "../assets/icons/onboarding/plus.svg";
import MicIcon from "../assets/icons/onboarding/sending.svg";


const OnBoarding:FunctionComponent = () => {
  	const navigate = useNavigate();
  	const rootRef = useRef<HTMLDivElement | null>(null);

  	useEffect(() => {
    	const root = rootRef.current;
    	if (!root) return;

    	// On desktop (wide viewport), show all bubbles immediately
    	const isDesktop = window.innerWidth > 430;
    	if (isDesktop) {
      		const selectors = [
        		styles.messageBubble2,
        		styles.messageBubble3,
        		styles.messageBubble5,
        		styles.messageBubble6,
        		styles.messageBubble7,
        		styles.messageBubble8,
        		styles.OnBoarding_messageBubble3,
        		styles.OnBoarding_messageBubble4,
        		styles.message17,
        		styles.message19,
        		styles.message20,
        		styles.message21,
      		].filter(Boolean).map(c => `.${c}`).join(',');
      		root.querySelectorAll<HTMLElement>(selectors).forEach(el => {
        		el.classList.add(styles.revealVisible);
      		});
      		return;
    	}

    	const selectors = [
      		styles.messageBubble2,
      		styles.messageBubble3,
      		styles.messageBubble5,
      		styles.messageBubble6,
      		styles.messageBubble7,
      		styles.messageBubble8,
      		styles.OnBoarding_messageBubble3,
      		styles.OnBoarding_messageBubble4,
      		styles.message17,
      		styles.message19,
      		styles.message20,
      		styles.message21,
    	]
      		.filter(Boolean)
      		.map((c) => `.${c}`)
      		.join(',');

    	if (!selectors) return;

    	const nodes = Array.from(root.querySelectorAll<HTMLElement>(selectors));
    	// Apply hidden state to all
    	nodes.forEach((el) => el.classList.add(styles.reveal));
    	// Make the first bubble visible immediately (no animation)
    	if (nodes.length > 0) {
      		nodes[0].classList.remove(styles.reveal);
      		nodes[0].classList.add(styles.revealVisible);
    	}

    	// IntersectionObserver for reveal-on-scroll
    	const io = new IntersectionObserver(
      		(entries) => {
        		entries.forEach((entry) => {
          			const el = entry.target as HTMLElement;
          			if (entry.isIntersecting) {
            			el.classList.add(styles.revealVisible);
          			}
        		});
      		},
      		{ root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.15 }
    	);

    	// Only observe elements that are **below** the first viewport at load.
    	const pending: HTMLElement[] = [];
    	const viewportH = window.innerHeight || document.documentElement.clientHeight;
    	nodes.forEach((el, idx) => {
      		if (idx === 0) return; // first stays visible
      		const rect = el.getBoundingClientRect();
      		if (rect.top < viewportH) {
        		// Element is already in view on first paint → delay observing until user scrolls
        		pending.push(el);
      		} else {
        		io.observe(el);
      		}
    	});

    	const onFirstScroll = () => {
      		pending.forEach((el) => io.observe(el));
      		pending.length = 0;
      		window.removeEventListener('scroll', onFirstScroll);
    	};
    	if (pending.length > 0) {
      		window.addEventListener('scroll', onFirstScroll, { once: true, passive: true } as AddEventListenerOptions);
    	}

    	return () => {
      		window.removeEventListener('scroll', onFirstScroll);
      		io.disconnect();
    	};
  	}, []);
  	return (
    		<div ref={rootRef} className={styles.OnBoarding}>
      			<div className={styles.safeArea} />
				
      			<div className={styles.messageBubblesGroup}>
        				<div className={styles.time}>
          					<span className={styles.yesterday}>Today</span>
          					<span className={styles.span}>{` `}</span>
          					<span className={styles.span}>5:12</span>
        				</div>
        				<div className={styles.messageBubble2}>
          					<div className={styles.message}>
            						<div className={styles.OnBoarding_message}>스크롤을 내려 사용 방법을 확인하세요.</div>
            						<img className={styles.tailIcon} alt="" src={Tail1Icon} />
          					</div>
          					<div className={styles.spacing} />
        				</div>
        				<div className={styles.messageBubble3}>
          					<div className={styles.spacing} />
          					<div className={styles.message1}>
            						<div className={styles.OnBoarding_message}>사용 방법</div>
            						<img className={styles.OnBoarding_tailIcon} alt="" src={TailIcon} />
          					</div>
        				</div>
        				<div className={styles.messageBubble2}>
          					<div className={styles.message}>
            						<div className={styles.OnBoarding_message}>
              							<p className={styles.p}>{`키워드를 골라 취향에 맞는 포타를 `}</p>
              							<p className={styles.p}>추천받으세요.</p>
            						</div>
          					</div>
          					<div className={styles.spacing} />
        				</div>
        				<div className={styles.OnBoarding_messageBubble4}>
          				<div className={styles.message}>
            					<div className={styles.OnBoarding_message}>
              						<p className={styles.p}>{`선택한 키워드와 가장 유사한 `}</p>
              						<p className={styles.p}>작품들이 우선 순위로 추천됩니다.</p>
            					</div>
          				</div>
          				<div className={styles.spacing} />
        				</div>
        				<div className={styles.messageBubble5}>
          				<div className={styles.message}>
            					<div className={styles.OnBoarding_message}>
              						<p className={styles.p}>{`단편: 1 - 4편 `}</p>
              						<p className={styles.p}>중편: 5 - 9편</p>
              						<p className={styles.p}>장편: 10편 이상으로 분류됩니다.</p>
            					</div>
          				</div>
          				<div className={styles.spacing} />
        				</div>
        				<div className={styles.messageBubble6}>
          				<div className={styles.message}>
            					<div className={styles.OnBoarding_message}>검색창 아래의 모드 버튼을 사용하여<br/>포함/제외 키워드 선택이 가능합니다.</div>
          				</div>
          				<div className={styles.spacing} />
        				</div>
        				<div className={styles.messageBubble7}>
          				<div className={styles.message}>
            					<div className={styles.OnBoarding_message}>
              						<p className={styles.p}>{`키워드 미선택시 무작위로 10개의 `}</p>
              						<p className={styles.p}>포타가 추천됩니다.</p>
            					</div>
            					<img className={styles.tailIcon} alt="" src={Tail1Icon} />
          				</div>
          				<div className={styles.spacing} />
        				</div>
        				<div className={styles.OnBoarding_messageBubble3}>
          				<div className={styles.spacing} />
          				<div className={styles.message1}>
            					<div className={styles.OnBoarding_message}>부가 기능</div>
            					<img className={styles.OnBoarding_tailIcon} alt="" src={TailIcon} />
          				</div>
        				</div>
        				<div className={styles.messageBubble8}>
          				<div className={styles.message}>
            					<div className={styles.OnBoarding_message}>메뉴 탭에서 다음과 같은 부가 기능 사용이 가능합니다.</div>
          				</div>
          				<div className={styles.spacing} />
        				</div>
        				<div className={styles.message17}>
          				<div className={styles.OnBoarding_message}>현재 등록된 추천작 확인</div>
        				</div>
        				<div className={styles.message19}>
          				<div className={styles.OnBoarding_message}>명대사 아카이브</div>
        				</div>
        				<div className={styles.message20}>
          				<div className={styles.OnBoarding_message}>키워드 수정</div>
        				</div>
        				<div className={styles.message20}>
          				<div className={styles.OnBoarding_message}>추천작 리스트에서 ✏️ 버튼을 눌러 새 작품을 직접 등록할 수 있습니다.</div>
        				</div>
        				<div className={styles.message21}>
          				<div className={styles.OnBoarding_message}>{`기타 문의사항이나 개선 사항 건의는 요청폼 마지막 질문에 입력 또는 트위터(X) @cxwdwggy로 디엠 주세요. `}</div>
          				<img className={styles.tailIcon} alt="" src={Tail1Icon} />
        				</div>
      			</div>
      			<div className={styles.inputBar}>
        				<div className={styles.plusButton}>
          					<img className={styles.div} alt="plus" src={PlusIcon} />
        				</div>
        				<div className={styles.input}>
          					<div className={styles.imessage}>키워드 고르러 가기</div>
          					<img className={styles.OnBoarding_div} alt="mic" src={MicIcon} onClick={() => navigate('/Mobile-Index')} />
        				</div>
      			</div>
      			<div className={styles.navigationBarMessages}>
        				<div className={styles.avatarAndName}>
          					<img className={styles.avatarIcon} alt="" src={AvatarIcon} />
          					<div className={styles.name}>
            						<div className={styles.navigationBarName}>오늘은 뭘 읽을까?</div>
              							<img className={styles.chevron} alt="chevron" src={ChevronIcon} />
              							</div>
              							</div>
              							<div className={styles.leftAndRightAccessories}>
                								<img
                								  className={styles.back}
                								  alt="back"
                								  src={BackIcon}
                								  onClick={() => navigate('/')}
                								/>
                								<div className={styles.facetime} />
              							</div>
              							</div>
              							
              							<div className={styles.navigationBarRightAccesso}>
                								<div className={styles.label} onClick={() => navigate('/Mobile-Index')}>Skip</div>
              							</div>
              							</div>);
            						};
            						
            						export default OnBoarding;