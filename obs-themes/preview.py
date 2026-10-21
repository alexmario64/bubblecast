"""Offscreen Qt widget render of composed themes; this is not an OBS screenshot."""
import os, sys, re, ast, operator
from pathlib import Path
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / '.local/theme-preview'))
os.environ['QT_QPA_PLATFORM'] = 'offscreen'
from PySide6.QtCore import Qt, QDir
from PySide6.QtGui import QIcon, QFontDatabase
from PySide6.QtWidgets import (QApplication, QMainWindow, QWidget, QDockWidget,
    QVBoxLayout, QHBoxLayout, QLabel, QListWidget, QPushButton, QSlider,
    QComboBox, QLineEdit, QToolBar, QToolButton)

installed = Path('C:/Program Files/obs-studio/data/obs-studio/themes')
QDir.addSearchPath('theme', str(installed))
QDir.addSearchPath('theme', str(root/'obs-themes'))
app = QApplication([])
app.setStyle('Fusion')
for font in ['segoeui.ttf','seguisb.ttf','segoeuib.ttf']:
    QFontDatabase.addApplicationFont('C:/Windows/Fonts/'+font)

def numeric(expr):
    ops = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
           ast.Div: operator.truediv, ast.USub: operator.neg}
    def read(n):
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)): return n.value
        if isinstance(n, ast.BinOp) and type(n.op) in ops: return ops[type(n.op)](read(n.left), read(n.right))
        if isinstance(n, ast.UnaryOp) and type(n.op) in ops: return ops[type(n.op)](read(n.operand))
        raise ValueError('Unsupported numeric expression')
    return read(ast.parse(expr.strip(), mode='eval').body)

def compose(file):
    parent = 'Yami_Default.ovt' if 'Console' in file.name else 'Yami_Light.ovt'
    texts = [(installed/'Yami.obt').read_text(encoding='utf-8-sig'),
             (installed/parent).read_text(encoding='utf-8-sig'), file.read_text()]
    variables = {'obsFontScale':'9', 'obsPadding':'-5'}
    for text in texts:
        block = re.search(r'@OBSThemeVars\s*\{([^}]+)\}', text)
        if block:
            variables.update(re.findall(r'--(\w+)\s*:\s*([^;]+);', re.sub(r'/\*.*?\*/','',block[1],flags=re.S)))
    cache = {}
    def resolve(name):
        if name in cache: return cache[name]
        value = re.sub(r'var\(--(\w+)\)', lambda m: resolve(m[1]), variables[name]).strip()
        for _ in range(50):
            def arithmetic(m):
                kind, args = m.groups()
                units = re.findall(r'(?:\d)(px|pt)\b', args)
                unit = units[0] if units else ''
                numbers = re.sub(r'(\d)(?:px|pt)\b', r'\1', args)
                result = numeric(numbers) if kind == 'calc' else (min if kind == 'min' else max)(numeric(x) for x in numbers.split(','))
                return f'{result:g}{unit}'
            new = re.sub(r'(calc|min|max)\(([^()]*)\)', arithmetic, value)
            if new == value: break
            value = new
        if value.startswith('"') and value.endswith('"'): value=value[1:-1]
        cache[name]=value
        return value
    qss = '\n'.join(re.sub(r'@OBSTheme(?:Meta|Vars)\s*\{[^}]*\}', '', text) for text in texts)
    qss = re.sub(r'/\*.*?\*/', '', qss, flags=re.S)
    qss = re.sub(r'var\(--(\w+)\)', lambda m: resolve(m[1]), qss)
    # OBS-only qproperties require OBS's own custom widgets, absent in this harness.
    qss = re.sub(r'qproperty-[\w-]+\s*:[^;]+;', '', qss)
    return qss

def render(name):
    app.setStyleSheet(compose(Path(__file__).parent/name))
    win=QMainWindow();win.resize(1280,840)
    win.setWindowTitle('Native Qt preview — not an OBS screenshot')
    for title in ['File','Edit','View','Docks','Profile','Scene Collection','Tools','Help']:
        win.menuBar().addMenu(title)
    center=QWidget();layout=QVBoxLayout(center);layout.setContentsMargins(18,18,18,18)
    label=QLabel('BUBBLECAST  /  NATIVE QT STYLE PREVIEW');label.setStyleSheet('font-size:11px;letter-spacing:1px;');layout.addWidget(label)
    preview=QLabel('Preview canvas');preview.setAlignment(Qt.AlignCenter)
    preview.setStyleSheet('background:#29252b;color:#b4a5b4;border:5px solid white;border-radius:16px;font-size:18px;')
    layout.addWidget(preview,1);caption=QLabel('Example widgets rendered with the actual composed Qt stylesheet.');layout.addWidget(caption)
    win.setCentralWidget(center)
    def dock(title,widget,area):
        d=QDockWidget(title);d.setWidget(widget);win.addDockWidget(area,d);return d
    def panel():
        w=QWidget();l=QVBoxLayout(w);l.setContentsMargins(9,9,9,9);l.setSpacing(7);return w,l
    scenes=QListWidget();scenes.addItems(['Starting soon','Just chatting','Gameplay','Be right back','Stream ending']);scenes.setCurrentRow(2)
    scenesPanel,scl=panel();scl.setContentsMargins(0,0,0,0);scl.addWidget(scenes)
    tools=QHBoxLayout();tools.setContentsMargins(8,0,8,8)
    for icon in ['plus','minus','gear']:
        b=QToolButton();b.setProperty('class','icon-'+icon)
        prefix='Dark' if 'Console' in name else 'Light'
        path='settings/general.svg' if icon=='gear' else icon+'.svg'
        source=root/'obs-themes/BubblecastConsole'/f'{icon}.svg' if 'Console' in name else installed/prefix/path
        b.setIcon(QIcon(str(source)));tools.addWidget(b)
    tools.addStretch();scl.addLayout(tools)
    dw1=dock('Scenes',scenesPanel,Qt.BottomDockWidgetArea)
    sources=QListWidget();sources.addItems(['Camera','Game capture','Bubblecast overlay','Alerts','Music']);sources.setCurrentRow(0)
    dw2=dock('Sources',sources,Qt.BottomDockWidgetArea);win.splitDockWidget(dw1,dw2,Qt.Horizontal)
    mixer,ml=panel()
    for title in ['Desktop audio','Microphone']:
        ml.addWidget(QLabel(title+'                         −7.0 dB'))
        slider=QSlider(Qt.Horizontal);slider.setValue(65);ml.addWidget(slider)
    ml.addStretch();dw3=dock('Audio Mixer',mixer,Qt.BottomDockWidgetArea);win.splitDockWidget(dw2,dw3,Qt.Horizontal)
    controls,cl=panel()
    for text in ['Start Streaming','Start Recording','Start Virtual Camera','Settings']:
        b=QPushButton(text)
        if text=='Start Streaming':b.setProperty('class','button-primary')
        cl.addWidget(b)
    dw4=dock('Controls',controls,Qt.BottomDockWidgetArea);win.splitDockWidget(dw3,dw4,Qt.Horizontal)
    side,sl=panel();sl.addWidget(QLabel('Connection settings'));pick=QComboBox();pick.addItems(['Twitch','YouTube Live','YouTube Shorts Live']);sl.addWidget(pick)
    sl.addWidget(QLabel('Channel'));field=QLineEdit('TrueAlexLIVE');sl.addWidget(field)
    sl.addWidget(QPushButton('Save connection'));sl.addSpacing(15)
    sl.addWidget(QLabel('Panels, controls and selection states'))
    for text in ['Ready to connect','Disabled action']:
        b=QPushButton(text);b.setDisabled(text=='Disabled action');sl.addWidget(b)
    sl.addStretch();side.setMinimumWidth(290);dock('Connections · example',side,Qt.RightDockWidgetArea)
    win.statusBar().showMessage('Theme preview only · actual OBS layout and plugin windows may differ')
    win.show();app.processEvents()
    win.resizeDocks([dw1,dw2,dw3,dw4],[230,230,290,230],Qt.Horizontal)
    win.resizeDocks([dw1],[260],Qt.Vertical);app.processEvents()
    scheme = 'console-glass' if 'Console' in name else 'red-white' if 'Red' in name else 'rose-peach'
    output=root.parent/('obs-native-'+scheme+'-qt-preview.png')
    win.grab().save(str(output));win.close();app.processEvents();print(output)

for filename in ['Bubblecast_Red_White.ovt','Bubblecast_Rose_Peach.ovt','Bubblecast_Console_Glass.ovt']:render(filename)
