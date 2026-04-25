export const HRC = [
  "", "순납 (Pure Lead)", "고순도 주석 (Pure Tin)", "인듐 합금 (Indium Alloy)", "연질 마그네슘 (Soft Magnesium)",
  "아연 합금 (Zinc Die-cast)", "연질 구리 (Annealed Copper)", "황동 생재 (Yellow Brass)", "알루미늄 1100",
  "알루미늄 3003", "알루미늄 6061-O", "순철 (Armco Iron)", "저탄소강 박판", "청동 합금 (Bronze)",
  "베릴륨동 (연질)", "알루미늄 7075-O", "SS400 (일반 구조용 강재)", "S10C (초저탄소강)",
  "S20C (저탄소강 생재)", "SUS304 (스테인리스강)", "알루미늄 7075-T6", "S30C (중탄소강 생재)",
  "S35C (중탄소강 생재)", "S45C (기계구조용 생재)", "SCM415 (크롬 몰리브덴강)", "S45C (조질 열처리 후)",
  "SCM440 (열처리 초기)", "SNCM8 (니켈 크롬 몰리브덴)", "고강도 철근 (SD500)", "SUS420J2 (저경도 열처리)",
  "고장력 볼트 (8.8등급)", "산업용 대형 기어", "굴삭기 버킷 투스 (기초)", "선박용 크랭크축",
  "특수 고진동 스프링강", "철도 레일 표면", "유압 실린더 로드", "다이캐스팅 금형강 (STD61)",
  "엔진 캠샤프트", "자동차 트랜스미션 기어", "SUP9 (스프링강 열처리)", "보급형 스패너", "대형 파이프 렌치",
  "소형 해머 머리", "공사용 정 (Chisel)", "저가형 정글도 (Machete)", "드라이버 비트 (보급형)", "다목적 가위 날",
  "목공용 끌", "저가형 주방칼 (420계열)", "소방용 도끼 날", "전선 절단기 (Nipper)", "볼트 커터 날",
  "원형 톱날 베이스", "산업용 드릴 척", "독일제 주방칼 (Wusthof)", "SK5 (탄소공구강)",
  "SKD11 (냉간 금형강)", "D2 (고탄소 고크롬강)", "VG-10 (고급 식칼강)", "154CM (미국산 나이프강)",
  "SUJ2 (고탄소 베어링강)", "일반 면도날 (Razor Blade)", "SKH51 (하이스강/HSS)", "일본 전통 식칼 (청지 2호)",
  "M390 (슈퍼 스테인리스강)", "CPM-S90V (분말강)", "고경도 줄 (Metal File)", "ZDP-189 (초고경도 분말강)",
  "텅스텐 카바이드 (초경)", "타일 절단용 다이아몬드 비트", "질화규소 (Si3N4) 세라믹",
  "지르코니아 (ZrO2) 세라믹", "알루미나 (Al2O3) 세라믹", "탄화규소 (SiC) 세라믹", "탄화붕소 (B4C)",
  "인조 사파이어", "다이아몬드 유사 코팅(DLC)", "미스릴 (Mithril)", "비브라늄 (Vibranium)", "아다만티움 (Adamantium)"
];
export const troopTiers = [
  { name: "돌", emoji: "🪨", power: 1, req: 0, speed: 1, flight: 5000, kind: "stone" },
  { name: "청동 도끼", emoji: "🪓", power: 1.4, req: 10, speed: 1, flight: 4000, kind: "axe" },
  { name: "철단검", emoji: "🗡️", power: 1.6, req: 20, speed: 2, flight: 2000, kind: "dagger" },
  { name: "총", emoji: "", power: 2, req: 40, speed: 3, flight: 1500, kind: "bullet" },
  { name: "번개창", emoji: "", power: 6, req: 70, speed: 1, flight: 0, kind: "lightning" },
  { name: "중력파", emoji: "🌑", power: 12, req: 90, speed: 0.8, flight: 2000, kind: "gravity" }
];
export const itemData = {
  repair: { name: "성벽 수리", emoji: "🔨", desc: "성벽 세그먼트 HP를 50% 회복합니다." },
  mine: { name: "지뢰", emoji: "💣", desc: "선택 지점 주변 적에게 큰 피해를 줍니다." },
  missile: { name: "탄도 미사일", emoji: "🚀", desc: "부락을 파괴하거나 넓은 범위 적을 타격합니다." },
  nuke: { name: "핵무기", emoji: "☢️", desc: "탄도 미사일 7배 범위에 재앙급 피해를 줍니다." },
  overtime: { name: "야근", emoji: "🌝", desc: "60초간 채굴량이 2배 증가합니다." },
  laser: { name: "위성 레이저", emoji: "🛰️", desc: "추적 레이저가 적을 집중 타격합니다." },
  thunderer: { name: "썬더러", emoji: "🌩️", desc: "20초간 0.6초마다 적 5기에게 낙뢰를 호출합니다." },
  windy: { name: "윈디", emoji: "🌬️", desc: "5초간 전체 적에게 바람 피해와 감속을 줍니다." }
};
export const difficultyData = {
  veryeasy: { name: "매우 쉬움", power: 0.35, emoji: "🙈", hpMult: 0.5, speedMult: 0.5, mineMult: 3, autoBonus: 4, newbieAura: true },
  easy: { name: "쉬움", power: 0.5, emoji: "🟦", spawnMult: 0.7, mineMult: 1.5 },
  normal: { name: "보통", power: 1, emoji: "🟢" },
  hard: { name: "어려움", power: 2, emoji: "🟠" },
  extreme: { name: "극한", power: 5, emoji: "🔴" },
  billions: { name: "They are billions", power: 1, emoji: "☠️", speedMult: 1.2, spawnMult: 1.5, villageMult: 3, fortHpMult: 0.65 }
};
export const buildings = [
  { id: "mine", name: "채굴장", emoji: "⛏️", sub: "🪵🪨", x: -155, y: -120, r: 54, color: "#8b693b", desc: "나무/돌/원석을 채집합니다." },
  { id: "forge", name: "공업소", emoji: "⚒️", sub: "🔥🔩", x: 155, y: -120, r: 54, color: "#983d24", desc: "원석과 금화로 HRC 소재를 제련합니다." },
  { id: "barracks", name: "병력소", emoji: "⚔️", sub: "🛡️🧑‍✈️", x: -155, y: 135, r: 54, color: "#586a7b", desc: "병력을 훈련하고 외곽 적을 요격합니다." },
  { id: "market", name: "시장", emoji: "💰", sub: "🪙📦", x: 155, y: 135, r: 54, color: "#a57b2d", desc: "자원을 금화로 바꿉니다." }
];
