#!/usr/bin/env python3
"""VOID STATION 에셋 빌드 스크립트.

인터넷에서 자유 라이선스 그래픽을 내려받아 게임이 쓰는 형태로 가공한다.
  - Freedoom (BSD-3-Clause): 캐릭터·몬스터·이펙트·아이템 스프라이트, 벽/바닥 텍스처, 효과음
      https://github.com/freedoom/freedoom
  - knekko "Futuristic Guns, Weapons and Items" (CC0): 무기·수류탄·주사기·방어구·케이스 아이콘
      https://opengameart.org/content/futuristic-guns-weapons-and-items
  - knekko "Cybericons"·"Microchips" (CC0): 팔 장비·강화칩·강화장신구·스킬 메뉴·최종 특성 아이콘
      https://opengameart.org/content/cybericons, https://opengameart.org/content/microchips-cpus-ics
  - Project Cordon Sprites (CC0, doficia와 기여자들): 헬멧·조끼·전투화·소모품 아이콘 (128px 픽셀아트)
      https://github.com/doficia/project-cordon-sprites
  - 갈무리 Galmuri (SIL OFL 1.1, 이민서): 한글 픽셀 글꼴 (웹 글꼴은 npm galmuri)
      https://github.com/quiple/galmuri

결과물 (assets/):
  atlas.png   스프라이트·아이콘 아틀라스
  atlas.js    프레임 좌표/원점, 회전별 스프라이트 표, 텍스처 목록 (window.ASSET_META)
  tex/*.png   벽 텍스처(패치 합성)와 바닥 텍스처
  sfx/*.wav   효과음
  music/*.mid 배경음악 (Freedoom MIDI 그대로, 게임이 신시사이저로 연주)
  fonts/*.woff2 글꼴 (갈무리), fonts/LICENSE-galmuri.txt
  LICENSE-freedoom.txt, CREDITS-freedoom.txt, CREDITS-freedoom-music.txt, README.md

아이콘 화풍 맞추기: 출처가 다른 아이콘(icon_*, att_*)을 한 묶음처럼 — Cordon 128px 그림은 1/2로 줄여 픽셀 굵기를 맞추고,
어두운 아이콘은 조금 밝히고 (unify_icon), 가장자리에 같은 빛 방향 (위·왼쪽 밝게, 아래·오른쪽 어둡게). 회색 외곽선은 게임이 UI에 그릴 때 두름

사용: python tools/build_assets.py   (내려받은 원본은 tools/.cache 에 캐시)
"""
import colorsys
import io
import json
import os
import re
import struct
import sys
import urllib.request
import zipfile

from PIL import Image, ImageDraw, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'tools', '.cache')
OUT = os.path.join(ROOT, 'assets')
FD_RAW = 'https://raw.githubusercontent.com/freedoom/freedoom/master/'
FD_TREE = 'https://api.github.com/repos/freedoom/freedoom/git/trees/master?recursive=1'
OGA = 'https://opengameart.org/sites/default/files/'

# 스프라이트 접두어: 쓸 프레임 글자
SPRITES = {
    'play': 'abcdefghijklmn',     # 플레이어 (걷기 a-d, 공격 e-f, 피격 g, 사망 h-n)
    'troo': 'abcdefghijklm',      # 제노이드 (Serpentipede)
    'skel': 'abcdefghijklmnopq',  # 스피터
    'head': 'abcdefghijkl',       # 스파크 드론 (Trilobite)
    'boss': 'abcdefghijklmno',    # 브루트 (Pain Lord)
    'bspi': 'abcdefghijklmnop',   # 크롤러 (Technospider)
    'cybr': 'abcdefghijklmnop',   # 보스 타이탄 (Large Technospider)
    'spid': 'abcdefghijklmnopqrs',  # 보스 하이브 마더
    'sarg': 'abcdefghijklmn',     # 차저
    'cpos': 'abcdefghijklmn',     # 감염 해병
    'pain': 'abcdefghijklm',      # 브루더
    'fatt': 'abcdefghijklmnopqrst',  # 모르타르
    'bar1': 'ab', 'bexp': 'abcde', 'misl': 'abcd', 'fire': 'abcdefgh', 'tfog': 'abcdefghij', 'ifog': 'abcde',
    'bal7': 'abcde', 'plss': 'ab', 'plse': 'abcde', 'puff': 'abcd', 'tlmp': 'abcd',
    'stim': 'a', 'medi': 'a', 'bon1': 'a', 'suit': 'a', 'arm1': 'a', 'clip': 'a', 'shel': 'a', 'ammo': 'a', 'brok': 'a',
    'sgn2': 'a', 'bpak': 'a',
    'bkey': 'ab', 'ykey': 'ab', 'rkey': 'ab',  # 키카드 (a/b 번갈아 깜박임)
    'bbrn': 'ab',    # 최종 보스 오버마인드 (Doom 2 마지막 보스의 뇌)
    'bosf': 'abcd',  # 오버마인드의 포자 (몬스터가 깨어남)
    'manf': 'ab',    # 화염탄
    'blud': 'abc',   # 플레이어 피격 시 피 튐
    'plas': 'a', 'laun': 'a', 'bfug': 'a',  # 에너지·중화기 (아이콘으로 씀)
    'cell': 'a', 'rock': 'a',                # 에너지 셀, 로켓 탄약
    'bfs1': 'ab', 'bfe1': 'abcd', 'bfe2': 'abcd',  # 분쇄포 구체와 폭발
    'bos2': 'abcdefghijklmno',  # 철갑 거수 (Freedoom의 장갑 괴수)
    'sswv': 'abcdhijlm',  # 생존자 (파란 제복의 기지 승무원: 걷기 a-d, 피격 h, 쓰러짐 i j l m)
    'col5': 'ab',         # 번식 둥지 (맥동하는 살덩이 기둥)
    # 스킬 쉘 그림·스킬 효과: 은신(흐림 구체), 중력장(무적 구체), 생명 흡수(영혼 구체), 광폭화, 집중 사격(고글), 강철 피부(갑옷),
    # 회전 톱날(전기톱), 포탑(체인건), 강습 돌진(로스트 소울), 드론(떠다니는 기계 해골), 테슬라 코일(기술 기둥·셀 팩),
    # 나노 수리(붉은 캡슐), 지뢰(붉은 눈 장치)
    'pins': 'abcd', 'pinv': 'abcd', 'soul': 'abcd', 'pstr': 'a', 'pvis': 'ab', 'arm2': 'ab', 'csaw': 'a', 'mgun': 'a',
    'skul': 'abc', 'fsku': 'abc', 'elec': 'a', 'celp': 'a', 'keen': 'a', 'ceye': 'abc',
    'vile': 'abcdefghijklmnopqrstuvwxyz',  # 감시자 (움직이지 않고 불기둥을 일으키는 적)
    'ysku': 'a',  # 금고 열쇠 (금빛 해골 열쇠)
    'tlp2': 'a',  # 조난 신호기 (키 큰 기술 등)
    'bal2': 'abcde',  # 보스 아르고스의 탄 (에너지 구체: 날기 a-b, 터짐 c-e)
    'pmap': 'ab',     # 데이터 기록 (바닥에 떨어진 휴대 단말기 — 화면이 깜박임)
}
# Freedoom 스프라이트를 그대로 무기 아이콘으로: 아이콘 이름 -> (스프라이트, 좌우 반전)
SPRITE_ICONS = {'sawedoff': ('sgn2a0', False), 'plasma': ('plasa0', False), 'launcher': ('launa0', False), 'bfg': ('bfuga0', False)}
# HUD 숫자: Freedoom 상태 바 그림 (sttnum 큰 빨간 숫자, stysnum 작은 노란 숫자) — 아틀라스 키 hud_이름
HUD_DIGITS = ['sttminus'] + [f'sttnum{i}' for i in range(10)] + [f'stysnum{i}' for i in range(10)]
# 같은 그림을 색만 바꾼 변종: 새 접두어 -> (원본 접두어, 색조 이동 0~1[, 바꿀 색조 범위 (lo, hi), 채도·밝기 배율 (s, v)])
DERIVED = {'bspr': ('bspi', 0.9),   # 질주 크롤러 (붉은 크롤러)
           'cpsh': ('cpos', 0.6),   # 방패 해병 (푸른 감염 해병)
           'sasn': ('sarg', 0.72),  # 그림자 추적자 (보랏빛 차저)
           'vsum': ('vile', 0.25),  # 되살리는 자 (초록빛 감시자)
           # 구역 보스 (크게 그림)
           'bsar': ('sarg', 0.08),  # 파쇄 짐승 (구릿빛 차저)
           'bpai': ('pain', 0.3),   # 번식 모체 (초록 브루더)
           'bhea': ('head', 0.8),   # 감시 포대 아르고스 (분홍 스파크 드론)
           'bfat': ('fatt', 0.18),  # 역병 거인 (누런 모르타르)
           'bvil': ('vile', 0.72),  # 공허 사제 (보랏빛 감시자)
           'bske': ('skel', 0.9),   # 처형자 (붉은 스피터)
           'sthf': ('sswv', 0.46, (0.5, 0.78), (1, 1.15)),  # 보물 약탈자 (푸른 제복만 금빛으로 — 피부·바지는 그대로)
           'blrk': ('bspi', 0.75, None, (1.1, 0.6)),        # 매복자 (어두운 보랏빛 크롤러)
           'tbur': ('troo', 0.07, None, (0.55, 0.85)),      # 굴착자 (흙빛 제노이드)
           'fskw': ('fsku', 0.5, None, (1.2, 1.0))}         # 수호 드론 (푸른 기계 해골 — 플레이어 드론은 붉은 그대로)

# 벽 텍스처(패치 합성)와 바닥 텍스처(flat)
WALL_TEX = ['STARTAN2', 'STARBR2', 'STARG3', 'STARGR1', 'TEKWALL1', 'METAL2', 'SUPPORT3', 'BROWN96', 'BRONZE1',
            'COMPTALL', 'COMPWERD', 'COMPSTA1', 'SPACEW3', 'SILVER2', 'PIPE4', 'BROWNPIP', 'CRATE2', 'BIGDOOR2',
            'DOORBLU', 'DOORYEL', 'DOORRED', 'DOORTRAK']  # 보안문 양 끝 색 표시등, 색 없는 문틀 (봉쇄 격벽·금고 문)
FLATS = ['aqf001', 'aqf029', 'aqf031', 'floor7_1', 'aqf004', 'floor0_6', 'aqf051', 'floor0_5', 'flat5_4', 'flat4',
         'aqf027', 'aqf026', 'ceil3_5', 'mflr8_1', 'aqf072', 'aqf045', 'floor5_1', 'aqf007', 'floor4_8', 'aqf005',
         'ceil5_1', 'gate4', 'cratop2', 'flat14', 'flat19']

# Freedoom 효과음 (sounds/*.wav, 8bit PCM 그대로 사용)
SOUNDS = ['dspistol', 'dsshotgn', 'dsdshtgn', 'dssgcock', 'dsdbload', 'dsswtchn', 'dsskeswg', 'dspunch', 'dsbarexp',
          'dsrxplod', 'dsflamst', 'dsplasma', 'dstelept', 'dsfirsht', 'dsitemup', 'dswpnup', 'dsgetpow', 'dsplpain',
          'dspldeth', 'dsoof', 'dsclaw', 'dssgtatk', 'dsskeatk', 'dsbgsit1', 'dsbgsit2', 'dsbgdth1', 'dsbgdth2',
          'dspopain', 'dsbspsit', 'dsbspdth', 'dsskesit', 'dsskedth', 'dscacsit', 'dscacdth', 'dsbrssit', 'dsbrsdth',
          'dsdmpain', 'dsslop', 'dsstnmov', 'dsbdopn', 'dsswtchx', 'dsitmbk',
          'dscybsit', 'dscybdth', 'dsspisit', 'dsspidth', 'dshoof', 'dsmetal', 'dsrlaunc', 'dsdoropn', 'dsdorcls',
          'dsbossit', 'dsbospit', 'dsboscub', 'dsbospn', 'dsbosdth', 'dsfirxpl', 'dsmanatk', 'dspstop',
          'dssgtsit', 'dssgtdth', 'dspesit', 'dspepain', 'dspedth', 'dsmansit', 'dsmandth', 'dsmnpain',
          'dsposit1', 'dsposit2', 'dsposit3', 'dspodth1', 'dspodth2', 'dspodth3', 'dsbfg',
          'dsradio', 'dsssdth', 'dspstart', 'dsbgact',  # 구역 임무: 생존자 합류·사망, 해킹 시작, 둥지
          'dsbspwlk', 'dsposact', 'dsdmact', 'dsbspact', 'dsskeact', 'dsbdcls',  # 분위기: 발걸음, 몬스터 기척, 먼 기계음
          'dskntsit', 'dskntdth',  # 철갑 거수 발견·사망
          'dssklatk', 'dssawup', 'dssawful', 'dssawhit', 'dsvilatk', 'dsflame',  # 스킬: 돌진, 회전 톱날, 화염 폭풍
          'dsvilsit', 'dsvildth', 'dsvipain', 'dsvilact']  # 감시자 발견·사망·피격·기척

# Freedoom 배경음악 (musics/*.mid 그대로 복사, 게임이 Web Audio 신시사이저로 연주) — data.js의 MUSIC과 맞출 것
MUSIC = ['d_e2m2', 'd_e3m8', 'd_dm17', 'd_victor', 'd_map21', 'd_e1m1', 'd_e4m8', 'd_e2m6', 'd_map23', 'd_map22',
         'd_e4m3', 'd_e1m7', 'd_map30',
         'd_map20', 'd_dm32', 'd_map13']  # 전투 곡

# knekko 시트에서 잘라낼 아이콘: 이름 -> (파일, (x0, y0, x1, y1), 후처리)
ICONS = {
    'knife':         ('melee_0.png',      (4, 74, 36, 82), None),
    'hammer':        ('melee_0.png',      (144, 37, 167, 82), 'rot'),
    'spear':         ('melee_0.png',      (71, 74, 135, 80), 'spear'),
    'chainsaw':      ('melee_0.png',      (87, 56, 134, 62), 'chain'),    # 마체테 칼날 -> 사슬 톱날 + 검은 서류가방(misc_3) -> 주황 엔진
    'baton':         ('melee_0.png',      (71, 74, 135, 80), 'shock'),    # 진압봉 끝에 전극 두 갈래와 불꽃
    'pblade':        ('melee_0.png',      (70, 11, 165, 21), 'plasma'),   # 카타나 칼날을 푸른 플라즈마로, 붉은 손잡이는 금속으로
    # 새 무기: 시트에서 아직 안 쓴 모양 + 색만 다른 그림 (청록 무늬 = 아크·감전, 자홍 무늬 = 헬파이어·화염, 얼룩 = 위장)
    'bat':           ('melee_0.png',      (4, 4, 14, 68), 'rot'),
    'wrench':        ('melee_0.png',      (20, 10, 33, 62), 'rot'),
    'axe':           ('melee_0.png',      (36, 9, 64, 58), 'rot'),
    'knuckles':      ('melee_0.png',      (42, 67, 64, 83), None),
    'crowbar':       ('melee_0.png',      (71, 32, 135, 50), None),
    'machete':       ('melee_0.png',      (71, 56, 134, 64), None),
    'heavypistol':   ('pistols.png',      (3, 2, 35, 29), None),
    'compact':       ('pistols.png',      (3, 70, 35, 92), None),
    'taser':         ('pistols.png',      (111, 3, 143, 26), None),
    'arcrevolver':   ('pistols.png',      (147, 35, 179, 59), None),
    'mp5':           ('machine_guns.png', (136, 5, 200, 37), None),
    'p90':           ('machine_guns.png', (111, 104, 175, 132), None),
    'arccarbine':    ('machine_guns.png', (5, 103, 102, 134), None),
    'combatpump':    ('shotguns_3.png',   (104, 59, 195, 85), None),
    'dragon':        ('shotguns_3.png',   (8, 92, 96, 121), None),
    'arcpump':       ('shotguns_3.png',   (103, 86, 195, 112), None),
    'arcsniper':     ('sniper_0.png',     (2, 2, 128, 27), None),
    'camolmg':       ('military.png',     (105, 3, 201, 35), None),
    'railgun':       ('military.png',     (4, 35, 100, 67), None),
    'hellhmg':       ('military.png',     (4, 67, 100, 99), None),
    'homingrl':      ('military.png',     (106, 38, 191, 65), None),
    'rpg':           ('military.png',     (106, 65, 191, 92), None),
    'neonpistol':    ('neonpunk.png',     (5, 2, 36, 24), None),
    'neonblaster':   ('neonpunk.png',     (45, 3, 125, 31), None),
    'neonshotgun':   ('neonpunk.png',     (43, 61, 139, 87), None),
    'revolver':      ('pistols.png',      (147, 3, 179, 27), None),
    'autopistol':    ('pistols.png',      (3, 36, 35, 62), None),
    'machinepistol': ('machine_guns.png', (4, 38, 68, 70), None),
    'doublebarrel':  ('shotguns_3.png',   (3, 5, 99, 31), 'coach'),   # 나무 개머리판 + 펌프 손잡이를 총열색으로 → 상하 2연발
    'pump':          ('shotguns_3.png',   (103, 4, 195, 30), None),
    'autoshotgun':   ('shotguns_3.png',   (8, 31, 96, 60), None),
    'marksman':      ('sniper_0.png',     (2, 29, 128, 54), None),
    'assault':       ('machine_guns.png', (5, 134, 102, 167), None),
    'mg':            ('military.png',     (4, 0, 100, 35), None),
    'syringe_red':   ('misc_3.png',       (99, 7, 115, 30), None),
    'syringe_blue':  ('misc_3.png',       (99, 38, 115, 61), None),
    'gren_frag':     ('misc_3.png',       (29, 3, 50, 29), None),
    'gren_gas':      ('misc_3.png',       (28, 35, 49, 61), ('tint', (0.75, 1.15, 0.55))),
    'gren_shock':    ('misc_3.png',       (3, 7, 20, 28), None),
    'gren_fire':     ('misc_3.png',       (2, 40, 19, 61), ('hue', 0.12)),
    'gren_cryo':     ('misc_3.png',       (3, 7, 20, 28), ('hue', 0.07)),
    'blades':        ('melee_0.png',      (4, 74, 36, 82), 'fan'),     # 칼날 부채 스킬: 총검 세 자루를 부채꼴로
    # 방어구 (바이저 헬멧·하의): 검은 장비는 어두운 칸에서도 보이게 밝힘. 헬멧 2종·조끼·전투화는 CORDON_ICONS
    'helm_visor':    ('armor_1.png',      (109, 5, 135, 37), ('tint', (1.3, 1.3, 1.3))),
    'pants':         ('armor_1.png',      (38, 56, 68, 80), ('tint', (1.6, 1.6, 1.6))),
    'pants_neon':    ('neonpunk.png',     (2, 63, 32, 87), None),
    # 필드 볼거리: 보급 캐시(흰 케이스), 금고 보물함(검은 가방을 금빛으로)
    'case_white':    ('misc_3.png',       (60, 5, 92, 30), None),
    'case_gold':     ('misc_3.png',       (60, 38, 92, 62), ('tint', (3.2, 2.5, 1.1))),
}
# 무기 파츠 그림 (knekko 무기에서 부품만 잘라 씀): 이름 -> (파일, (x0, y0, x1, y1), 후처리, 붙는 칸)
# 게임은 무기 그림의 붙는 자리(META.anchors)에 파츠 그림의 붙는 점(프레임의 ox·oy, ATTACH_PIVOT)을 맞춰 겹쳐 그림
ATTACH_ART = {
    'suppressor': ('melee_0.png',      (118, 74, 135, 80), None, 'muzzle'),        # 진압봉 끝 마디 (홈이 팬 원통)
    'brake':      ('machine_guns.png', (85, 142, 101, 146), None, 'muzzle'),       # M4 총구 소염기
    'longbarrel': ('sniper_0.png',     (96, 37, 128, 41), None, 'muzzle'),         # 저격소총 총열 끝
    'choke':      ('shotguns_3.png',   (186, 5, 195, 11), None, 'muzzle'),         # 펌프 샷건 총구
    'reddot':     ('pistols.png',      (19, 2, 29, 6), 'lens', 'sight'),           # 권총 위 소형 조준기 + 붉은 점
    'holo':       ('machine_guns.png', (145, 104, 168, 113), None, 'sight'),       # P90 일체형 광학 조준기
    'scope':      ('sniper_0.png',     (31, 29, 64, 37), None, 'sight'),           # 저격소총 스코프
    'thermal':    ('sniper_0.png',     (31, 29, 64, 37), ('tint', (0.75, 1.5, 0.85)), 'sight'),  # 스코프를 초록빛으로 (열상)
    'extmag':     ('machine_guns.png', (47, 153, 56, 167), None, 'mag'),           # M4 탄창
    'drum':       ('military.png',     (13, 13, 29, 27), None, 'mag'),             # 중기관총 상자 탄창
    'quickmag':   ('machine_guns.png', (176, 21, 188, 37), None, 'mag'),           # MP5 곡선 탄창
    'apmag':      ('machine_guns.png', (47, 153, 56, 167), ('band', (255, 210, 60)), 'mag'),   # M4 탄창 + 노란 띠 (철갑탄)
    'incmag':     ('machine_guns.png', (47, 153, 56, 167), ('band', (255, 80, 40)), 'mag'),    # M4 탄창 + 붉은 띠 (소이탄)
    'lightstock': ('machine_guns.png', (5, 140, 27, 156), None, 'stock'),          # M4 접이식 개머리판
    'heavystock': ('sniper_0.png',     (2, 39, 21, 53), None, 'stock'),            # 저격소총 개머리판
    'vgrip':      ('machine_guns.png', (186, 15, 192, 25), None, 'under'),         # MP5 수직 손잡이
    'laser':      ('pistols.png',      (130, 5, 143, 11), 'laser', 'under'),       # 테이저 카트리지를 쇳빛으로 + 붉은 렌즈
    # 근접 무기
    'serrated':   ('melee_0.png',      (120, 56, 134, 62), 'teeth', 'edge'),       # 마체테 칼끝에 톱니
    'weight':     ('melee_0.png',      (150, 37, 162, 44), None, 'edge'),          # 슬레지해머 머리 한 토막
    'mono':       ('melee_0.png',      (146, 11, 165, 17), 'mono', 'edge'),        # 카타나 칼끝을 푸른빛으로
    'wrap':       ('melee_0.png',      (4, 76, 13, 80), ('tint', (1.6, 1.1, 0.7)), 'grip'),   # 총검 손잡이를 가죽색으로
    'absorb':     ('melee_0.png',      (71, 74, 83, 80), None, 'grip'),            # 진압봉 손잡이 홈
    'shockmod':   ('pistols.png',      (133, 6, 142, 13), None, 'module'),         # 테이저 카트리지 앞쪽
    'firemod':    ('pistols.png',      (133, 6, 142, 13), ('hue', 0.88), 'module'),
    'cryomod':    ('pistols.png',      (133, 6, 142, 13), ('hue', 0.4), 'module'),
}
# 파츠 그림의 붙는 점: 칸 -> (가로, 세로) 비율 (0 왼쪽·위, 1 오른쪽·아래)
ATTACH_PIVOT = {'muzzle': (0, 0.5), 'sight': (0.5, 1), 'mag': (0.5, 0), 'under': (0.5, 0), 'stock': (1, 0.5),
                'grip': (1, 0.5), 'module': (0.5, 0.5), 'edge': (0.5, 0.5)}
# 무기 그림의 붙는 자리를 직접 정함 (자동으로 찾은 자리가 어색한 무기): 무기 -> {칸: (x, y)}
# M4·MP5는 원래 탄창 자리, 중기관총(뒤쪽 상자 탄창)·로켓은 탄창 자리, 저격소총은 원래 스코프를 덮게
ANCHOR_FIX = {'assault': {'mag': (46, 19)}, 'arccarbine': {'mag': (46, 19)}, 'mp5': {'mag': (46, 16), 'under': (53, 10)},
              'mg': {'mag': (17, 10)}, 'camolmg': {'mag': (17, 10)}, 'hellhmg': {'mag': (17, 10)}, 'railgun': {'mag': (17, 10)},
              'marksman': {'sight': (45, 8)}, 'arcsniper': {'sight': (45, 8)}, 'rpg': {'mag': (62, 15)}, 'homingrl': {'mag': (62, 15)}}
# 팔 장비·강화칩·강화장신구·스킬 메뉴 그림: knekko "Cybericons"·"Microchips" (CC0, zip 안의 32x32) — 이름 -> (묶음, 파일, 후처리)
# 강화칩은 능력치마다 보조·증폭·코어 3단계 (작은 칩 → 큰 칩 → CPU), 강화장신구는 계열마다 3단계
CYBER_ZIPS = {'cyber': ('cybericons.zip', 'knekko_cybericons.zip'), 'chips': ('microchips.zip', 'knekko_microchips.zip')}
CYBER_ICONS = {
    'arm_dark':   ('cyber', 'Hands-extention.png', None),
    'arm_silver': ('cyber', 'Hands.png', None),
    'arm_neon':   ('cyber', 'Hands.png', ('tint', (0.55, 1.2, 1.25))),  # 연구동 시제품: 은색 손을 청록으로
    'chip_str1': ('chips', '10.png', None), 'chip_str2': ('chips', '05.png', None), 'chip_str3': ('chips', '04.png', None),
    'chip_agi1': ('chips', '11.png', None), 'chip_agi2': ('chips', '06.png', None), 'chip_agi3': ('chips', '03.png', None),
    'chip_tec1': ('chips', '07.png', None), 'chip_tec2': ('chips', '08.png', None), 'chip_tec3': ('chips', '01.png', None),
    'chip_psi1': ('chips', '09.png', None), 'chip_psi2': ('chips', '12.png', None), 'chip_psi3': ('chips', '02.png', None),
    'acc_str1': ('cyber', 'PaceMaker.png', None), 'acc_str2': ('cyber', 'Heart.png', None), 'acc_str3': ('cyber', 'Spine.png', None),
    'acc_agi1': ('cyber', 'displayglas.png', None), 'acc_agi2': ('cyber', 'optics.png', None), 'acc_agi3': ('cyber', 'optics-2.png', None),
    'acc_tec1': ('cyber', 'Explant.png', None), 'acc_tec2': ('cyber', 'Module2.png', None), 'acc_tec3': ('cyber', 'VR2.png', None),
    'acc_psi1': ('cyber', 'EEG.png', None), 'acc_psi2': ('cyber', 'Neural-implant.png', None), 'acc_psi3': ('cyber', 'Neural-implant-2.png', None),
    'brain':      ('cyber', 'Brain.png', None),  # 스킬 창 메뉴 아이콘
    'perk_prey':    ('cyber', 'Redeye.png', None),                          # 특성 '거물 사냥': 붉은 조준경
    'perk_regen':   ('cyber', 'Heart-2.png', None),                         # 특성 '재생 조직': 회로 심장
    'perk_command': ('cyber', 'VRblack.png', ('tint', (1.7, 1.7, 1.8))),  # 특성 '전술 지휘': 전술 헤드셋 (어두운 칸에서도 보이게 밝힘)
}
# 더 세밀한 방어구·소모품 그림: Project Cordon Sprites (CC0, GitHub의 128px 픽셀아트 낱장) — 이름 -> (경로, 후처리)
# 조끼는 한 종류라 색만 바꿔 네 가지로, 사막색 군화는 어두운 회색으로. 소모품 셋은 HUD·상점용 (바닥의 소모품은 Freedoom 그림 그대로)
CORDON_RAW = 'https://raw.githubusercontent.com/doficia/project-cordon-sprites/master/sprites/'
CORDON_ICONS = {
    'helm_army':   ('armors/army-helmet.png', None),
    'helm_kevlar': ('armors/kevlar-helmet.png', None),
    'vest_tac':    ('armors/tactical-vest.png', ('tint', (1.35, 1.2, 0.85))),  # 방탄 조끼: 모래색
    'vest_black':  ('armors/tactical-vest.png', None),                          # 플레이트 캐리어: 원래 색
    'vest_heavy':  ('armors/tactical-vest.png', ('tint', (0.75, 0.8, 0.95))),  # 중장갑 조끼: 어두운 강철색
    'vest_neon':   ('armors/tactical-vest.png', ('tint', (0.55, 1.2, 1.25))),  # 네온 강화복: 청록
    'boots':       ('armors/military-boots.png', ('gray', (0.62, 0.62, 0.68))),
    'medkit':      ('consumables/medkit.png', None),
    'pills':       ('consumables/painkillers.png', None),
    'injection':   ('consumables/injection.png', None),
}
# 글꼴: 갈무리 (이민서, SIL OFL 1.1) — 한글 픽셀 글꼴. Galmuri11은 12px의 배수, Galmuri14는 15px의 배수에서 또렷함
GALMURI = 'https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/'
FONTS = ['Galmuri11.woff2', 'Galmuri11-Bold.woff2', 'Galmuri14.woff2']
# 핏자국 (바닥 데칼): AlejandroHaibi "Liquid Splatter Pixel Texture" (CC0) — 흰 스플래터(8px 픽셀 덩어리)를 덩어리별로 나눠 변형을 만들고 1/4로 줄임
# 게임에서 몬스터 체액 색으로 칠해 바닥에 눕혀 그림. 이름 -> 쓸 큰 덩어리 번호 (큰 것부터 0, 1, ...; 'all'은 전부) — 가까운 작은 방울은 함께
SPLAT_FILE = 'blood_splatter_0.png'
SPLATS = {'splat_a': 'all', 'splat_b': [0], 'splat_c': [1, 2, 3], 'splat_d': [1], 'splat_e': [2, 3]}
README = """# assets/ — 그래픽 출처와 라이선스

이 폴더는 `python tools/build_assets.py` 가 만든 결과물입니다. 직접 고치지 말고 스크립트를 다시 실행하세요.

## Freedoom — BSD-3-Clause
- 출처: https://github.com/freedoom/freedoom (스프라이트, 벽 패치, 바닥 텍스처, 상태 바 숫자, 효과음, 배경음악)
- 라이선스 전문: `LICENSE-freedoom.txt`, 기여자 목록: `CREDITS-freedoom.txt`, 곡별 작곡자: `CREDITS-freedoom-music.txt`
- 배경음악은 원본 MIDI 그대로(`music/*.mid`), 게임이 Web Audio 신시사이저로 연주
- 가공: 스프라이트를 `atlas.png` 한 장으로 묶음, 벽 텍스처는 `textures.cfg` 정의대로 패치를 합성(`tex/wall_*.png` — 평균 밝기가 낮은 벽은 감마로 밝힘),
  바닥은 원본 그대로(`tex/flat_*.png`), 효과음은 원본 WAV 그대로(`sfx/*.wav`)
- 색조만 바꾼 몬스터 변종: 질주 크롤러(거미), 방패 해병(좀비맨), 그림자 추적자(데몬), 되살리는 자(아치바일),
  구역 보스 — 파쇄 짐승(데몬), 번식 모체(페인 엘리멘탈), 아르고스(카코데몬), 역병 거인(맨큐버스), 공허 사제(아치바일), 처형자(레버넌트)
- 보물 약탈자: 승무원(SS 대원) 스프라이트의 푸른 제복만 금빛으로 바꿈

## knekko "Futuristic Guns, Weapons and Items" — CC0 (퍼블릭 도메인)
- 출처: https://opengameart.org/content/futuristic-guns-weapons-and-items
- 무기·수류탄·주사기·방어구·케이스(보급 캐시·금고 보물함, 보물함은 금빛으로 물들임) 아이콘으로 잘라 씀 (바이저 헬멧·하의는 armor_1.png, 네온 하의는 neonpunk.png). 해머는 90도 회전, 창은 진압봉에 날을 그려 넣음,
  2연발은 펌프 손잡이를 총열색으로 칠함, 수류탄 일부는 색조를 바꿈 (출처 표기는 필수 아님)
  (체인톱은 마체테 칼날에 사슬 무늬를 넣고 검은 서류가방을 주황 엔진으로 칠해 붙임, 방전 진압봉은 진압봉 끝에 전극과 불꽃을 그려 넣음,
  플라즈마 블레이드는 카타나 칼날을 푸른빛으로·손잡이를 금속색으로 칠함)
  (무기 파츠 그림은 시트의 무기에서 부품만 잘라 씀 — 스코프·총열·개머리판은 저격소총, 탄창·소염기·접이식 개머리판은 M4, 곡선 탄창·앞손잡이는 MP5,
  상자 탄창은 중기관총, 광학 조준기는 P90, 소음기는 진압봉 끝, 모듈·레이저는 테이저 카트리지(색을 바꿈), 근접 파츠는 마체테·해머·카타나·총검·진압봉에서)
  (소드오프 아이콘은 Freedoom의 2연발 샷건 스프라이트, 칼날 부채 스킬 그림은 총검 세 자루를 부채꼴로 겹침)

## Project Cordon Sprites — CC0 (퍼블릭 도메인)
- 출처: https://github.com/doficia/project-cordon-sprites (doficia와 커뮤니티 기여자들, CC0-1.0)
- 128px 픽셀아트 낱장을 1/2로 줄여 씀 (다른 아이콘과 픽셀 굵기를 맞춤): 전투 헬멧(army-helmet), 정찰 헬멧(kevlar-helmet), 조끼 4종(tactical-vest의 색만 바꿈),
  전투화(military-boots를 어두운 회색으로), HUD·상점의 소모품(medkit, painkillers, injection)

## knekko "Cybericons"·"Microchips" — CC0 (퍼블릭 도메인)
- 출처: https://opengameart.org/content/cybericons, https://opengameart.org/content/microchips-cpus-ics
- 32x32 아이콘을 그대로 씀: 팔 장비(기계 손), 강화칩(마이크로칩), 강화장신구(인공 심장·척추·의안·바이저·단말기·뇌파 머리띠·신경 이식체), 스킬 메뉴(뇌),
  최종 특성(붉은 조준경·회로 심장·전술 헤드셋, 헤드셋은 밝힘).
  네온 건틀릿은 은색 손을 청록으로 칠함

## 갈무리 (Galmuri) — SIL Open Font License 1.1
- 출처: https://github.com/quiple/galmuri (이민서), 웹 글꼴은 npm galmuri 2.40.3 (jsDelivr)
- `fonts/Galmuri11.woff2`, `fonts/Galmuri11-Bold.woff2`, `fonts/Galmuri14.woff2`를 그대로 씀. 라이선스 전문: `fonts/LICENSE-galmuri.txt`

## 아이콘 공통 가공 (화풍 맞추기)
- 모든 아이콘(무기·방어구·소모품·파츠)은 평균 밝기가 낮으면 감마로 조금 밝히고 (평균 80까지, 감마 0.6 이상),
  가장자리에 같은 빛 방향을 입힘 (위·왼쪽 가장자리는 밝게, 아래·오른쪽 가장자리는 어둡게). 회색 외곽선은 게임이 UI에 그릴 때 두름

## AlejandroHaibi "Liquid Splatter Pixel Texture" — CC0 (퍼블릭 도메인)
- 출처: https://opengameart.org/content/liquid-splatter-pixel-texture
- 흰 스플래터 한 장을 덩어리별로 나눠 핏자국 변형 5개(splat_a~e)로 쓰고 1/4로 줄임. 게임에서 몬스터 체액 색으로 칠함
"""


def fetch(url, name):
    os.makedirs(CACHE, exist_ok=True)
    fn = os.path.join(CACHE, name)
    if not os.path.exists(fn):
        req = urllib.request.Request(url, headers={'User-Agent': 'void-station-asset-build'})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        with open(fn, 'wb') as f:
            f.write(data)
    return fn


def grab_offset(path):
    """PNG grAb 청크(Doom 스프라이트 원점)를 읽는다."""
    b = open(path, 'rb').read()
    i = 8
    while i < len(b):
        ln = struct.unpack('>I', b[i:i + 4])[0]
        if b[i + 4:i + 8] == b'grAb':
            return struct.unpack('>ii', b[i + 8:i + 16])
        i += 12 + ln
    return None


def build_offsets():
    """buildcfg.txt 의 [sprites] 절에 적힌 원점."""
    offs, section = {}, None
    for line in open(fetch(FD_RAW + 'buildcfg.txt', 'buildcfg.txt'), encoding='utf-8'):
        s = line.split(';')[0].strip()
        if s.startswith('['):
            section = s
            continue
        p = s.split()
        if section == '[sprites]' and len(p) >= 3 and re.fullmatch(r'-?\d+', p[1]) and re.fullmatch(r'-?\d+', p[2]):
            offs[p[0].lower()] = (int(p[1]), int(p[2]))
    return offs


def parse_textures():
    """textures.cfg (#ifdef 등 전처리 포함) -> {이름: {w, h, patches}}"""
    tex, cur, stack = {}, None, []
    for line in open(fetch(FD_RAW + 'lumps/textures/textures.cfg', 'textures.cfg'), encoding='utf-8'):
        s = line.split(';')[0].strip()
        if not s:
            continue
        if s.startswith('#'):
            p = s.split()
            if p[0] == '#ifdef':
                stack.append(False)
            elif p[0] == '#ifndef':
                stack.append(True)
            elif p[0] == '#else':
                stack[-1] = not stack[-1]
            elif p[0] == '#endif':
                stack.pop()
            continue
        if not all(stack):
            continue
        if s.startswith('*'):
            _, pn, x, y = s.split()
            tex[cur]['p'].append((pn.lower(), int(x), int(y)))
        else:
            n, w, h = s.split()[:3]
            cur = n
            tex[n] = {'w': int(w), 'h': int(h), 'p': []}
    return tex


def hue_shift(im, dh, rng=None, sv=(1, 1)):
    """채도 있는 색의 색조를 dh만큼 돌림 (rng: 이 색조 범위만, sv: 바꾼 색의 채도·밝기 배율)"""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s > 0.25 and (rng is None or rng[0] <= h <= rng[1]):
                r, g, b = colorsys.hsv_to_rgb((h + dh) % 1, min(1, s * sv[0]), min(1, v * sv[1]))
                px[x, y] = (int(r * 255), int(g * 255), int(b * 255), a)
    return im


def gray(im, mul):
    """무채색으로 바꾼 뒤 채널마다 곱함 (다이아몬드처럼 희게)"""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a:
                lum = 0.3 * r + 0.59 * g + 0.11 * b
                px[x, y] = (min(255, int(lum * mul[0])), min(255, int(lum * mul[1])), min(255, int(lum * mul[2])), a)
    return im


def splat_icons():
    """흰 스플래터를 덩어리(8방향 연결)로 나눠 SPLATS 변형을 만듦 — 작은 방울은 고른 덩어리 가까이(40px) 있는 것만 함께"""
    im = Image.open(fetch(OGA + SPLAT_FILE, 'blood_splatter.png')).convert('RGBA')
    w, h = im.size
    a = im.split()[3].load()
    seen, comps = set(), []
    for y in range(h):
        for x in range(w):
            if not a[x, y] or (x, y) in seen:
                continue
            st, px = [(x, y)], []
            seen.add((x, y))
            while st:
                cx, cy = st.pop()
                px.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        q = (cx + dx, cy + dy)
                        if 0 <= q[0] < w and 0 <= q[1] < h and a[q] and q not in seen:
                            seen.add(q)
                            st.append(q)
            xs, ys = [p[0] for p in px], [p[1] for p in px]
            comps.append((len(px), (min(xs), min(ys), max(xs) + 1, max(ys) + 1), px))
    comps.sort(key=lambda c: -c[0])
    big, drops = [c for c in comps if c[0] > 200], [c for c in comps if c[0] <= 200]
    out = {}
    for name, pick in SPLATS.items():
        chosen = big if pick == 'all' else [big[n] for n in pick]
        near = lambda c: any(b[1][0] - 40 <= c[1][0] <= b[1][2] + 40 and b[1][1] - 40 <= c[1][1] <= b[1][3] + 40 for b in chosen)
        part = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        pp = part.load()
        for c in chosen + [d for d in drops if pick == 'all' or near(d)]:
            for q in c[2]:
                pp[q] = (255, 255, 255, 255)
        part = trim(part)
        out[name] = part.resize((max(1, part.width // 4), max(1, part.height // 4)), Image.NEAREST)
    return out


def cordon_icon(spec):
    path, post = spec
    im = Image.open(fetch(CORDON_RAW + path, 'cordon_' + path.replace('/', '_'))).convert('RGBA')
    if post and post[0] == 'tint':
        im = tint(im, post[1])
    elif post and post[0] == 'gray':
        im = gray(im, post[1])
    return trim(half(im))


def half(im):
    """1/2로 줄이고 반투명은 0 또는 불투명으로 (픽셀아트 가장자리)"""
    im = im.resize((max(1, round(im.width / 2)), max(1, round(im.height / 2))), Image.LANCZOS)
    r, g, b, a = im.split()
    return Image.merge('RGBA', (r, g, b, a.point(lambda v: 255 if v >= 110 else 0)))


ICON_LIFT = (80, 0.6)  # 아이콘 평균 밝기가 이보다 낮으면 감마로 이 밝기 근처까지 (감마는 이 값 이상 — 일부러 어두운 장비는 어두운 채로)


def unify_icon(im):
    """아이콘 화풍 맞추기: 어두우면 조금 밝히고, 가장자리에 같은 빛 방향 (위·왼쪽 밝게, 아래·오른쪽 어둡게). 크기는 그대로 (파츠가 붙는 자리)"""
    lum = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
    px = [c for c in im.getdata() if c[3]]
    target, gmin = ICON_LIFT
    if px and sum(lum(c) for c in px) / len(px) < target:
        lo, hi = gmin, 1.0
        for _ in range(18):  # 평균이 target이 되는 감마를 이분 탐색
            g = (lo + hi) / 2
            if sum(lum([255 * (v / 255) ** g for v in c[:3]]) for c in px[::3]) / len(px[::3]) < target:
                hi = g
            else:
                lo = g
        lut = [round(255 * (v / 255) ** max(gmin, g)) for v in range(256)]
        r, gg, b, a = im.split()
        im = Image.merge('RGBA', (r.point(lut), gg.point(lut), b.point(lut), a))
    out, src, (w, h) = im.copy(), im.load(), im.size
    px = out.load()
    solid = lambda x, y: 0 <= x < w and 0 <= y < h and src[x, y][3] > 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = src[x, y]
            if not a:
                continue
            if not solid(x, y - 1) or not solid(x - 1, y):
                px[x, y] = (min(255, int(r * 1.25) + 6), min(255, int(g * 1.25) + 6), min(255, int(b * 1.25) + 6), a)
            elif not solid(x, y + 1) or not solid(x + 1, y):
                px[x, y] = (int(r * 0.75), int(g * 0.75), int(b * 0.75), a)
    return out


def cyber_icon(spec):
    pack, path, post = spec
    src, cache = CYBER_ZIPS[pack]
    im = Image.open(io.BytesIO(zipfile.ZipFile(fetch(OGA + src, cache)).read(path))).convert('RGBA')
    if post and post[0] == 'tint':
        im = tint(im, post[1])
    return trim(im)


def tint(im, mul):
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            px[x, y] = (min(255, int(r * mul[0])), min(255, int(g * mul[1])), min(255, int(b * mul[2])), a)
    return im


WALL_MIN = 70   # 벽 텍스처 평균 밝기(0~255)가 이보다 낮으면
WALL_LIFT = 78  # 감마로 어두운 곳을 들어 올려 이 밝기 근처로 (밝은 곳은 덜 바뀜 — 게임 화면에서 너무 어두운 벽이 없게)


def lift_dark(im):
    mean = lambda q: ImageStat.Stat(q.convert('L')).mean[0]
    if mean(im) >= WALL_MIN:
        return im
    lo, hi = 0.2, 1.0
    for _ in range(20):  # 평균이 WALL_LIFT가 되는 감마를 이분 탐색
        g = (lo + hi) / 2
        if mean(im.point([round(255 * (v / 255) ** g) for v in range(256)] * 3)) < WALL_LIFT:
            hi = g
        else:
            lo = g
    return im.point([round(255 * (v / 255) ** g) for v in range(256)] * 3)


def trim(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def halo(im, col, x0=0):
    """x0 오른쪽의 그림 둘레 1칸에 반투명 빛 (캔버스를 사방 1칸 넓힘)"""
    w, h = im.size
    out = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0))
    out.paste(im, (1, 1))
    src, px = im.load(), out.load()
    for y in range(h):
        for x in range(x0, w):
            if not src[x, y][3]:
                continue
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    qx, qy = x + dx, y + dy
                    if not (0 <= qx < w and 0 <= qy < h and src[qx, qy][3]) and not px[qx + 1, qy + 1][3]:
                        px[qx + 1, qy + 1] = col
    return out


def chain_saw(bar):
    """마체테 칼날을 사슬 톱날로 (위아래 테두리를 어두운·밝은 마디로, 3칸마다 톱니), 검은 서류가방을 주황 엔진 몸체로 붙임"""
    bw, bh = bar.size
    saw = Image.new('RGBA', (bw + 2, bh + 2), (0, 0, 0, 0))
    saw.paste(bar, (0, 1))
    px = saw.load()
    for x in range(bw):
        for y in (1, bh):
            if px[x, y][3]:
                px[x, y] = (210, 210, 215, 255) if x % 2 else (30, 30, 34, 255)
        if x % 3 == 0 and x < bw - 2:
            px[x, 0] = px[x, bh + 1] = (190, 190, 196, 255)
    body = Image.open(fetch(OGA + 'misc_3.png', 'knekko_misc_3.png')).convert('RGBA').crop((61, 38, 91, 62))
    body = body.resize((round(body.width * 0.7), round(body.height * 0.7)), Image.NEAREST)
    bp = body.load()
    for y in range(int(body.height * 0.22), body.height):  # 손잡이 아래 몸통만 주황으로
        for x in range(body.width):
            r, g, b, a = bp[x, y]
            if a:
                l = (r + g + b) / 3
                bp[x, y] = (232, 118, 28, a) if l > 40 else (150, 62, 14, a) if l > 12 else (40, 22, 10, a)
    out = Image.new('RGBA', (body.width + saw.width - 2, max(body.height, saw.height)), (0, 0, 0, 0))
    out.alpha_composite(saw, (body.width - 2, max(0, body.height - saw.height - 2)))
    out.alpha_composite(body, (0, 0))
    return out


def make_icon(name, spec):
    fn, box, post = spec
    im = Image.open(fetch(OGA + fn, 'knekko_' + fn)).convert('RGBA').crop(box)
    if post == 'rot':                      # 세로 해머 -> 가로 (머리가 오른쪽)
        im = im.rotate(-90, expand=True)
    elif post == 'chain':                  # 체인톱
        im = chain_saw(im)
    elif post == 'shock':                  # 진압봉 끝에 전극 두 갈래 + 그 사이 번개, 둘레에 불꽃
        w, h = im.size
        sh = Image.new('RGBA', (w + 6, h + 6), (0, 0, 0, 0))
        sh.paste(im, (0, 3))
        d = ImageDraw.Draw(sh)
        d.line([(w, 3), (w + 3, 3)], fill=(150, 156, 170, 255))
        d.line([(w, h + 2), (w + 3, h + 2)], fill=(150, 156, 170, 255))
        for q in [(w + 3, 4), (w + 4, 5), (w + 3, 6), (w + 4, 7), (w + 3, h + 1)]:
            sh.putpixel(q, (215, 245, 255, 255))
        for q in [(w + 5, 4), (w + 5, 7), (w - 3, 1), (w + 1, 1), (w + 5, 1), (w - 2, h + 4), (w + 2, h + 4), (w + 5, h + 4)]:
            sh.putpixel(q, (120, 210, 255, 200))
        for q in [(w + 4, 2), (w - 1, 2), (w + 4, h + 3)]:
            sh.putpixel(q, (255, 245, 170, 255))
        im = sh
    elif post == 'plasma':                 # 칼날(손잡이·코등이 오른쪽 x>=24)을 푸른 플라즈마로 + 둘레 빛, 붉은 체크 손잡이는 금속
        px, (w, h) = im.load(), im.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if not a:
                    continue
                if x >= 24:
                    l = (r + g + b) / 3
                    t = min(1, l / 170) ** 0.9
                    px[x, y] = (20, 110, 170, a) if l < 30 else (int(60 + 180 * t), int(190 + 65 * t), 255, a)
                elif r > g + 40:
                    px[x, y] = (88, 96, 116, a) if r > 120 else (46, 50, 64, a)
        im = halo(im, (90, 210, 255, 110), 24)
    elif post == 'spear':                  # 진압봉 끝에 고주파 날 추가
        w, h = im.size
        sp = Image.new('RGBA', (w + 12, h + 6), (0, 0, 0, 0))
        sp.paste(im, (0, 3))
        d = ImageDraw.Draw(sp)
        d.polygon([(w - 1, 0), (w + 11, (h + 6) // 2), (w - 1, h + 5)], fill=(120, 230, 255, 255), outline=(20, 60, 80, 255))
        im = sp
    elif post == 'coach':                  # 앞쪽 나무 펌프 손잡이를 총열색으로 칠해 2연발처럼
        px, (w, h) = im.load(), im.size
        for y in range(h):
            for x in range(w // 2, w):
                r, g, b, a = px[x, y]
                if a and r > g > b and r - b > 30:
                    px[x, y] = (40, 42, 46, a) if r + g + b < 330 else (78, 82, 88, a)
    elif post == 'fan':                    # 손잡이를 아래 가운데에 모으고 칼끝을 위로 펼침
        w, h = im.size
        fan = Image.new('RGBA', (2 * w + 8, 2 * w + 8), (0, 0, 0, 0))
        c = fan.width // 2
        for a in (-40, 0, 40):
            layer = Image.new('RGBA', fan.size, (0, 0, 0, 0))
            layer.paste(im, (c, c - h // 2))  # 손잡이 끝이 회전 중심
            fan.alpha_composite(layer.rotate(90 - a, center=(c, c), resample=Image.NEAREST))
        im = tint(fan, (1.5, 1.5, 1.6))  # 어두운 칸 위에서도 보이게 칼날을 밝힘
    elif isinstance(post, tuple) and post[0] == 'hue':
        im = hue_shift(im, post[1])
    elif isinstance(post, tuple) and post[0] == 'tint':
        im = tint(im, post[1])
    return trim(im)


def attach_icon(spec):
    """파츠 그림 하나 (ATTACH_ART) -> (그림, 붙는 점 (x, y))"""
    fn, box, post, slot = spec
    im = trim(Image.open(fetch(OGA + fn, 'knekko_' + fn)).convert('RGBA').crop(box))
    w, h = im.size
    px = im.load()
    if post == 'lens':                      # 조준기 가운데 붉은 점
        px[w // 2, 1] = (255, 50, 40, 255)
    elif post == 'laser':                   # 노란 카트리지 -> 쇳빛, 앞쪽에 붉은 렌즈
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a and r > 150 and g > 150 and b < 100:
                    px[x, y] = (96, 100, 108, a) if (x + y) % 3 else (70, 74, 82, a)
        px[w - 2, h // 2] = (255, 40, 40, 255)
    elif post == 'teeth':                   # 위쪽 테두리에 2칸마다 톱니
        t = Image.new('RGBA', (w, h + 1), (0, 0, 0, 0))
        t.paste(im, (0, 1))
        tp = t.load()
        for x in range(1, w - 1, 2):
            if tp[x, 1][3]:
                tp[x, 0] = (200, 200, 206, 255)
        im = t
    elif post == 'mono':                    # 칼날 전체를 푸른 플라즈마로 + 둘레 빛
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a:
                    l = (r + g + b) / 3
                    t = min(1, l / 170) ** 0.9
                    px[x, y] = (20, 110, 170, a) if l < 30 else (int(60 + 180 * t), int(190 + 65 * t), 255, a)
        im = halo(im, (90, 210, 255, 110))
    elif isinstance(post, tuple) and post[0] == 'band':  # 탄창 가운데에 색 띠 (특수탄)
        for y in range(int(h * 0.3), int(h * 0.5) + 1):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a and (r + g + b) / 3 > 45:
                    px[x, y] = post[1] + (a,)
    elif isinstance(post, tuple) and post[0] == 'hue':
        im = hue_shift(im, post[1])
    elif isinstance(post, tuple) and post[0] == 'tint':
        im = tint(im, post[1])
    fx, fy = ATTACH_PIVOT[slot]
    return im, (round((im.width - 1) * fx), round((im.height - 1) * fy))


def weapon_types():
    """data.js의 WEAPONS에서 무기 id -> ('gun' | 'melee', 분류 번호) (붙는 자리를 찾을 무기 그림)"""
    src = open(os.path.join(ROOT, 'data.js'), encoding='utf-8').read()
    body = src[src.index('const WEAPONS = {'):]
    body = body[:body.index('\n};')]
    return {m.group(1): (m.group(3), int(m.group(2))) for m in re.finditer(r"^\s+(\w+):\s*\{\s*name: '[^']*', cat: (\d), type: '(\w+)'", body, re.M)}


def anchors_for(im, kind, cat):
    """무기 그림에서 파츠가 붙는 자리: 총 -> 총구·조준경·탄창·개머리판·하부, 근접 -> 손잡이·모듈·날 ({칸: [x, y]})
    권총류(분류 1)는 손잡이 속 탄창이라 손잡이 끝에서 아래로 늘어나게 붙임"""
    w, h = im.size
    a = im.split()[3].load()
    cols = [[y for y in range(h) if a[x, y]] for x in range(w)]
    mid = lambda x: (cols[x][0] + cols[x][-1]) / 2
    xs = [x for x in range(w) if cols[x]]

    def mid_at(x0, x1):
        ys = [mid(x) for x in range(max(0, x0), min(w, x1)) if cols[x]]
        return round(sum(ys) / len(ys)) if ys else h // 2
    if kind == 'melee':
        return {'grip': [min(4, w // 4), mid_at(0, 3)], 'module': [round(w * 0.42), mid_at(round(w * 0.42) - 1, round(w * 0.42) + 2)],
                'edge': [round(w * 0.8), mid_at(round(w * 0.8) - 1, round(w * 0.8) + 2)]}
    xr = xs[-1]
    out = {'muzzle': [xr - 1, mid_at(xr - 2, xr + 1)], 'stock': [5, mid_at(0, 3)]}
    band = [x for x in range(int(w * 0.3), int(w * 0.65)) if cols[x]]  # 조준경: 가운데 윗면
    out['sight'] = [round((band[0] + band[-1]) / 2), min(cols[x][0] for x in band) + 1]
    bots = sorted(cols[x][-1] for x in xs)
    body = bots[int(len(bots) * 0.35)]  # 몸통 아랫면 (손잡이·탄창처럼 아래로 늘어진 곳을 뺀 높이)
    runs, cur = [], None                # 아래로 늘어진 구간 (왼쪽 끝 개머리판은 뺌)
    for x in range(w):
        low = cols[x] and cols[x][-1] > body + 3
        if low and cur is None:
            cur = [x, x]
        elif low:
            cur[1] = x
        if (not low or x == w - 1) and cur is not None:
            if cur[0] > 2:
                runs.append(cur)
            cur = None
    yb = max(cols[x][-1] for x in xs)
    if cat == 1:  # 권총류: 가장 아래 두 줄의 가운데 (손잡이 끝)
        low = [x for x in xs if cols[x][-1] >= yb - 1]
        out['mag'] = [round((low[0] + low[-1]) / 2), yb - 2]
    elif runs:    # 탄창: 가장 깊이 늘어진 구간
        r = max(runs, key=lambda r: max(cols[x][-1] for x in range(r[0], r[1] + 1)))
        out['mag'] = [round((r[0] + r[1]) / 2), body]
    else:
        out['mag'] = [round(w * 0.45), body]
    ux = round(w * 0.72)
    out['under'] = [ux, cols[ux][-1] if cols[ux] else body]
    return out


def pack(images, width=2048, pad=2):
    """선반(shelf) 방식 아틀라스 패킹. images: {key: Image} -> ({key: (x, y)}, (w, h))"""
    order = sorted(images, key=lambda k: -images[k].height)
    pos, x, y, shelf = {}, pad, pad, 0
    for k in order:
        w, h = images[k].size
        if x + w + pad > width:
            x, y, shelf = pad, y + shelf + pad, 0
        pos[k] = (x, y)
        x += w + pad
        shelf = max(shelf, h)
    return pos, (width, y + shelf + pad)


def main():
    os.makedirs(os.path.join(OUT, 'tex'), exist_ok=True)
    tree = json.load(open(fetch(FD_TREE, 'freedoom_tree.json'), encoding='utf-8'))
    paths = [t['path'] for t in tree['tree'] if t['type'] == 'blob']
    sprite_files = {os.path.basename(p)[:-4]: p for p in paths if p.startswith('sprites/') and p.endswith('.png')}
    patch_files = {os.path.basename(p)[:-4]: p for p in paths if p.startswith('patches/') and p.endswith('.png')}
    offsets = build_offsets()

    # --- 스프라이트 ---
    images, frames, table = {}, {}, {}
    for pre, letters in SPRITES.items():
        tab = {}
        for stem, path in sorted(sprite_files.items()):
            if not stem.startswith(pre):
                continue
            pairs = re.findall(r'([a-z])([0-8])', stem[len(pre):])
            if not pairs or pairs[0][0] not in letters:
                continue
            fn = fetch(FD_RAW + path, 'sp_' + stem + '.png')
            im = Image.open(fn).convert('RGBA')
            off = offsets.get(stem) or grab_offset(fn) or (im.width // 2, im.height - 4)
            images[stem] = im
            frames[stem] = [0, 0, im.width, im.height, off[0], off[1]]
            for n, (fr, rot) in enumerate(pairs):
                if fr not in letters:
                    continue
                rots = tab.setdefault(fr, [None] * 8)
                flip = n > 0  # 두 번째 프레임/회전 표기는 좌우 반전으로 쓴다 (Doom 규칙)
                if rot == '0':
                    for r in range(8):
                        rots[r] = rots[r] or [stem, False]
                else:
                    rots[int(rot) - 1] = [stem, flip]
        for fr, rots in tab.items():   # 빠진 회전은 정면으로 채움
            for r in range(8):
                rots[r] = rots[r] or rots[0] or next(x for x in rots if x)
        table[pre] = tab
        print(f'sprite {pre}: frames {"".join(sorted(tab))}')
    for new, (src, dh, *opt) in DERIVED.items():  # 색만 바꾼 변종: 원본과 같은 프레임·회전 구성
        tab = {}
        for fr, rots in table[src].items():
            out = []
            for stem, flip in rots:
                key = new + stem[len(src):]
                if key not in images:
                    images[key] = hue_shift(images[stem].copy(), dh, *opt)
                    frames[key] = list(frames[stem])
                out.append([key, flip])
            tab[fr] = out
        table[new] = tab
        print(f'sprite {new}: {src} 색 변종')

    # --- 아이콘 ---
    for name, spec in ICONS.items():
        im = make_icon(name, spec)
        key = 'icon_' + name
        images[key] = im
        frames[key] = [0, 0, im.width, im.height, im.width // 2, im.height // 2]
    for name, spec in CYBER_ICONS.items():  # 팔 장비·강화칩·강화장신구·스킬 메뉴 (knekko Cybericons·Microchips)
        im = cyber_icon(spec)
        images['icon_' + name] = im
        frames['icon_' + name] = [0, 0, im.width, im.height, im.width // 2, im.height // 2]
    for name, spec in CORDON_ICONS.items():  # 헬멧 2종·조끼·전투화·소모품 (Project Cordon)
        im = cordon_icon(spec)
        images['icon_' + name] = im
        frames['icon_' + name] = [0, 0, im.width, im.height, im.width // 2, im.height // 2]
    for name, im in splat_icons().items():  # 핏자국 (AlejandroHaibi, CC0) — 흰색: 게임에서 칠함
        images[name] = im
        frames[name] = [0, 0, im.width, im.height, im.width // 2, im.height // 2]
    for name, (stem, flip) in SPRITE_ICONS.items():  # 소드오프(짧은 2연발)·에너지 무기는 Freedoom 스프라이트
        im = trim(images[stem])
        if flip:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        images['icon_' + name] = im
        frames['icon_' + name] = [0, 0, im.width, im.height, im.width // 2, im.height // 2]
    for name in HUD_DIGITS:
        im = Image.open(fetch(FD_RAW + 'graphics/' + name + '.png', 'gr_' + name + '.png')).convert('RGBA')
        images['hud_' + name] = im
        frames['hud_' + name] = [0, 0, im.width, im.height, 0, 0]
    for name, spec in ATTACH_ART.items():  # 무기 파츠: 프레임의 ox·oy가 붙는 점
        im, (ox, oy) = attach_icon(spec)
        images['att_' + name] = im
        frames['att_' + name] = [0, 0, im.width, im.height, ox, oy]
    for k in images:  # 아이콘 화풍 맞추기 (무기·방어구·소모품·파츠 — 크기는 그대로)
        if k.startswith('icon_') or k.startswith('att_'):
            images[k] = unify_icon(images[k])
    anchors = {}  # 무기 그림마다 파츠가 붙는 자리
    for wid, (kind, cat) in weapon_types().items():
        if 'icon_' + wid in images:
            anchors[wid] = {**anchors_for(images['icon_' + wid], kind, cat), **{k: list(v) for k, v in ANCHOR_FIX.get(wid, {}).items()}}

    pos, size = pack(images)
    atlas = Image.new('RGBA', size, (0, 0, 0, 0))
    for k, (x, y) in pos.items():
        atlas.paste(images[k], (x, y))
        frames[k][0], frames[k][1] = x, y
    atlas.save(os.path.join(OUT, 'atlas.png'), optimize=True)

    # --- 텍스처 ---
    texdefs = parse_textures()
    textures = {}
    for name in WALL_TEX:
        t = texdefs[name]
        im = Image.new('RGBA', (t['w'], t['h']), (0, 0, 0, 255))
        for pn, x, y in t['p']:
            p = Image.open(fetch(FD_RAW + patch_files[pn], 'pt_' + pn + '.png')).convert('RGBA')
            im.paste(p, (x, y), p)
        key = 'wall_' + name.lower()
        im = im.convert('RGB')
        if 'DOOR' not in name:  # 어두운 벽은 밝힘 (문 색 표시는 그대로)
            im = lift_dark(im)
        im.save(os.path.join(OUT, 'tex', key + '.png'))
        textures[key] = [t['w'], t['h']]
    for name in FLATS:
        im = Image.open(fetch(FD_RAW + 'flats/' + name + '.png', 'fl_' + name + '.png')).convert('RGB')
        key = 'flat_' + name
        im.save(os.path.join(OUT, 'tex', key + '.png'))
        textures[key] = [im.width, im.height]

    # --- 효과음 ---
    os.makedirs(os.path.join(OUT, 'sfx'), exist_ok=True)
    for name in SOUNDS:
        with open(fetch(FD_RAW + 'sounds/' + name + '.wav', 'sfx_' + name + '.wav'), 'rb') as a, \
                open(os.path.join(OUT, 'sfx', name + '.wav'), 'wb') as b:
            b.write(a.read())

    # --- 배경음악 (MIDI) ---
    os.makedirs(os.path.join(OUT, 'music'), exist_ok=True)
    for name in MUSIC:
        with open(fetch(FD_RAW + 'musics/' + name + '.mid', 'mus_' + name + '.mid'), 'rb') as a, \
                open(os.path.join(OUT, 'music', name + '.mid'), 'wb') as b:
            b.write(a.read())

    meta = {'atlas': 'assets/atlas.png', 'frames': frames, 'sprites': table, 'textures': textures, 'sounds': SOUNDS, 'anchors': anchors}
    with open(os.path.join(OUT, 'atlas.js'), 'w', encoding='utf-8') as f:
        f.write('// tools/build_assets.py 가 생성한 파일 — 직접 고치지 마세요\n')
        f.write('window.ASSET_META = ' + json.dumps(meta, separators=(',', ':')) + ';\n')

    os.makedirs(os.path.join(OUT, 'fonts'), exist_ok=True)  # 글꼴 (갈무리) + 라이선스 전문
    for name in FONTS + ['LICENSE.txt']:
        with open(fetch(GALMURI + name, 'galmuri_' + name), 'rb') as a, open(os.path.join(OUT, 'fonts', 'LICENSE-galmuri.txt' if name == 'LICENSE.txt' else name), 'wb') as b:
            b.write(a.read())

    # --- 라이선스 ---
    for src, dst in (('COPYING.adoc', 'LICENSE-freedoom.txt'), ('CREDITS', 'CREDITS-freedoom.txt'),
                     ('CREDITS-MUSIC', 'CREDITS-freedoom-music.txt')):
        with open(fetch(FD_RAW + src, src), 'rb') as a, open(os.path.join(OUT, dst), 'wb') as b:
            b.write(a.read())
    with open(os.path.join(OUT, 'README.md'), 'w', encoding='utf-8') as f:
        f.write(README)
    print(f'atlas {size[0]}x{size[1]}, {len(images)} images, {len(textures)} textures')


if __name__ == '__main__':
    sys.exit(main())
