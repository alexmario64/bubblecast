import {writeFile} from 'node:fs/promises';
const themes=[{
 file:'Bubblecast_Rose_Peach.ovt',name:'Bubblecast 1 - Rose & Peach',id:'local.bubblecast.rose',
 colors:{grey1:'#bca4b8',grey2:'#fffaf4',grey3:'#fff6ee',grey4:'#f4e8e9',grey5:'#ecdadf',grey6:'#faf2ec',grey7:'#d8b5c6',grey8:'#c1a3b7',primary:'#42aaa5',primary_light:'#c8e9e3',primary_lighter:'#57bdb4',primary_dark:'#258b86',primary_darker:'#20766f',text:'#59435f',text_light:'#705576',text_muted:'#94798f',input_bg:'#fffaf6',input_bg_hover:'#ffffff',input_bg_focus:'#ffffff',border_color:'#e6d5df',button_bg:'#fff9f2',button_bg_hover:'#ffffff',button_bg_down:'#e8d7e1',button_bg_disabled:'#eee1e7',button_border:'#ffffff',button_border_hover:'#a5d4cd',button_border_focus:'#48b9af',window_start:'#c594b2',window_end:'#efcba0',panel:'#faf1e9',title_start:'#f4e1e4',title_end:'#f9eadc',selection_bg:'#d7eee8',selection_text:'#356b68',scrollbar_handle:'#d6bccc',scrollbar_hover:'#bba2b8',scrollbar_down:'#a78aa5',scrollbar_bg:'#f8edea',scrollbar_border:'#f8edea'}
},{
 file:'Bubblecast_Red_White.ovt',name:'Bubblecast 2 - Red & White',id:'local.bubblecast.red',
 colors:{grey1:'#bca3a3',grey2:'#ffffff',grey3:'#fffafa',grey4:'#f7ecec',grey5:'#efdddd',grey6:'#fffcfc',grey7:'#efdede',grey8:'#d8bdbd',primary:'#e46565',primary_light:'#f6d3d3',primary_lighter:'#ec7777',primary_dark:'#c44545',primary_darker:'#a93636',text:'#604849',text_light:'#795c5d',text_muted:'#947979',input_bg:'#ffffff',input_bg_hover:'#ffffff',input_bg_focus:'#ffffff',border_color:'#eddada',button_bg:'#ffffff',button_bg_hover:'#fff4f4',button_bg_down:'#f5dede',button_bg_disabled:'#f2e7e7',button_border:'#f1dfdf',button_border_hover:'#e5a2a2',button_border_focus:'#e66565',window_start:'#f1d3d3',window_end:'#ffffff',panel:'#fffafa',title_start:'#ffffff',title_end:'#fcf0f0',selection_bg:'#f8dede',selection_text:'#a14545',scrollbar_handle:'#e5caca',scrollbar_hover:'#cfaaaa',scrollbar_down:'#bf8e8e',scrollbar_bg:'#fff9f9',scrollbar_border:'#fff9f9'}
}];
const common={bg_window:'var(--window_start)',bg_base:'var(--panel)',bg_preview:'#c6bec3',text_disabled:'#b9a5b4',text_inactive:'var(--text_light)',input_border:'var(--border_color)',input_border_hover:'var(--primary_light)',input_border_focus:'var(--primary)',button_border_width:'1px',input_border_width:'1px',border_radius:'8px',border_radius_small:'5px',border_radius_large:'12px',list_item_bg_selected:'var(--selection_bg)',list_item_bg_hover:'var(--button_bg_hover)',highlight_color:'var(--primary)',tab_bg:'var(--button_bg)',tab_bg_hover:'var(--button_bg_hover)',tab_bg_down:'var(--selection_bg)',tab_border:'var(--border_color)',tab_border_selected:'var(--primary)',tab_border_focus:'var(--primary)',separator_hover:'var(--primary)',palette_highlight:'var(--selection_bg)',palette_highlightedText:'var(--selection_text)',palette_link:'var(--primary_dark)',palette_linkVisited:'var(--primary_dark)'};
// Native controls need their own spacing floor: OBS can be configured with a
// negative density, which otherwise flattens the rounded card treatment.
Object.assign(common,{font_base_value:'max(10, var(--obsFontScale))',padding_base_value:'max(4, var(--obsPadding))',padding_large:'5px',spacing_base:'3px',spacing_large:'6px',text_disabled:'#aa9ba5',bg_preview:'#e5dee3',border_radius:'10px',border_radius_large:'16px'});
Object.assign(themes[0].colors,{text:'#46364d',text_light:'#634c6a',text_muted:'#827085',grey1:'#ac94a9',grey2:'#ffffff',grey3:'#fffaf6',grey4:'#f3e7ef',grey5:'#e8d6e0',grey6:'#fffaf5',grey7:'#d0a2bb',grey8:'#b794ae',panel:'#fffaf6',title_start:'#f2dfe8',title_end:'#fff5e8',window_start:'#be8eaf',window_end:'#efcea6',border_color:'#e5cddc',button_bg:'#ffffff',button_border:'#ead8e1',selection_bg:'#d6eee8',selection_text:'#235d58'});
Object.assign(themes[1].colors,{text:'#3f3338',text_light:'#5b444c',text_muted:'#7e6972',grey1:'#ac959e',grey2:'#ffffff',grey3:'#fffafa',grey4:'#f8ecee',grey5:'#eddbdf',grey6:'#ffffff',grey7:'#f0cdd1',grey8:'#d9b8c0',panel:'#ffffff',title_start:'#fff8f8',title_end:'#fff0ef',window_start:'#ecc8ce',window_end:'#fff6ed',primary:'#ee5455',primary_lighter:'#f56b65',primary_dark:'#cf4147',primary_darker:'#b82f39',border_color:'#edd6db',button_bg:'#ffffff',button_border:'#ead7dd',selection_bg:'#fff1f0',selection_text:'#ae303e'});
themes.push({file:'Bubblecast_Console_Glass.ovt',name:'Bubblecast 3 - Console Glass',id:'local.bubblecast.console',extends:'com.obsproject.Yami.Original',dark:true,colors:{
 grey1:'#b88fae',grey2:'#c89cba',grey3:'rgba(255,255,255,30)',grey4:'rgba(255,255,255,22)',grey5:'rgba(255,255,255,15)',grey6:'rgba(255,255,255,12)',grey7:'#7e426e',grey8:'#5c3155',
 primary:'#f7e4ed',primary_light:'rgba(255,255,255,62)',primary_lighter:'#ffffff',primary_dark:'#a05a8d',primary_darker:'#854475',text:'#fff9f5',text_light:'#fff9f5',text_muted:'#efcedf',text_disabled:'#ccacc3',text_inactive:'#efcedf',
 input_bg:'rgba(255,255,255,18)',input_bg_hover:'rgba(255,255,255,29)',input_bg_focus:'rgba(255,255,255,32)',input_border:'rgba(255,255,255,45)',input_border_hover:'rgba(255,255,255,120)',input_border_focus:'#ffffff',
 border_color:'rgba(255,255,255,48)',button_bg:'rgba(255,255,255,22)',button_bg_hover:'rgba(255,255,255,42)',button_bg_down:'rgba(255,255,255,60)',button_bg_disabled:'rgba(255,255,255,10)',button_border:'rgba(255,255,255,60)',button_border_hover:'rgba(255,255,255,140)',button_border_focus:'#ffffff',
 window_start:'#753463',window_end:'#aa8153',panel:'rgba(255,255,255,20)',bg_base:'rgba(255,255,255,10)',bg_window:'#84466f',bg_preview:'#402c40',title_start:'rgba(255,255,255,22)',title_end:'rgba(255,255,255,10)',selection_bg:'rgba(255,255,255,26)',selection_text:'#ffffff',
 scrollbar_handle:'rgba(255,255,255,85)',scrollbar_hover:'rgba(255,255,255,130)',scrollbar_down:'#fff4eb',scrollbar_bg:'rgba(255,255,255,0)',scrollbar_border:'rgba(255,255,255,0)',font_base_value:'max(10.5, var(--obsFontScale))',spacing_large:'10px',border_radius:'13px',border_radius_large:'24px'
}});
// Switch-inspired visual language: a red navigation strip, turquoise focus
// rings, pearl utility buttons, and cooler glass over a soft landscape palette.
Object.assign(themes[2].colors,{primary:'#36e0d3',primary_light:'rgba(54,224,211,100)',primary_lighter:'#85f4e8',primary_dark:'#169c95',primary_darker:'#107d79',window_start:'#476a78',window_end:'#a7977a',bg_window:'#567d83',bg_preview:'#364d59',selection_bg:'rgba(255,255,255,36)',selection_text:'#ffffff',button_border_focus:'#51e6d8',input_border_focus:'#51e6d8'});
const rules=`
/* Inherits native widgets and light icons from the installed OBS Light style.
   Browser docks have their own appearance. No preview/output widgets are hidden. */
QMainWindow, OBSBasic {
    background: qlineargradient(x1: 0, y1: 0, x2: 1, y2: 1,
        stop: 0 var(--window_start), stop: 1 var(--window_end));
}
QDialog { background: var(--panel); }
QWidget { font-family: 'Segoe UI', Arial; selection-background-color: var(--selection_bg); selection-color: var(--selection_text); }
QDockWidget {
    color: var(--text_light);
    background: var(--panel);
    border: 1px solid var(--button_border);
    border-radius: 16px;
}
QDockWidget > QWidget { background: var(--panel); }
QMainWindow::separator { width: 7px; height: 7px; background: transparent; }
QMainWindow::separator:hover { background: var(--primary_light); border: none; margin: 0; }
QDockWidget::title {
    background: qlineargradient(x1: 0, y1: 0, x2: 1, y2: 0,
        stop: 0 var(--title_start), stop: 1 var(--title_end));
    color: var(--text_light);
    border: none;
    border-bottom: 1px solid var(--border_color);
    border-top-left-radius: 15px;
    border-top-right-radius: 15px;
    font-size: var(--font_base);
    font-weight: bold;
    padding: 9px 10px;
}
QDockWidget::close-button:hover, QDockWidget::float-button:hover {
    background: var(--primary_light);
    border-radius: 7px;
}
QMenuBar, QStatusBar { background: var(--panel); color: var(--text_muted); }
QMenuBar { border-bottom: 1px solid var(--border_color); padding: 3px; }
QMenuBar::item { border-radius: 8px; padding: 6px 10px; color: var(--text_light); }
QMenuBar::item:selected { background: var(--selection_bg); color: var(--selection_text); }
QMenu { background: var(--panel); border: 1px solid var(--border_color); border-radius: 10px; padding: 5px; }
QMenu::item { border-radius: 6px; padding: 6px 24px; }
QMenu::item:selected { background: var(--selection_bg); color: var(--selection_text); }
QMenu::item:disabled { color: var(--text_disabled); }
QToolTip { color: var(--text); background: var(--button_bg); border: 1px solid var(--border_color); border-radius: 6px; padding: 6px 9px; }
QListView, QListWidget, QTreeView, QTableView, QTextEdit, QPlainTextEdit {
    background: var(--panel); border-color: var(--border_color); border-radius: 9px;
}
QListView::item, QListWidget::item, QTreeView::item, SourceTreeItem {
    border-radius: 8px; padding: 6px 8px; margin: 1px 2px;
}
QListView::item:selected, QListWidget::item:selected, QTreeView::item:selected, QTableView::item:selected,
QListView::item:selected:focus, QListWidget::item:selected:focus, QTreeView::item:selected:focus,
QListView::item:selected:hover, QListWidget::item:selected:hover, QTreeView::item:selected:hover {
    color: var(--selection_text); background: var(--selection_bg); border: 1px solid var(--primary);
}
QListView::item:hover, QListWidget::item:hover, QTreeView::item:hover {
    background: var(--button_bg_hover); border: 1px solid var(--border_color);
}
QPushButton, QComboBox, QLineEdit, QSpinBox, QDoubleSpinBox { border-radius: 10px; }
QComboBox, QLineEdit, QSpinBox, QDoubleSpinBox {
    background: var(--input_bg); border: 1px solid var(--input_border); padding: 6px 10px;
}
QPushButton { padding: 6px 10px; border: 1px solid var(--button_border); color: var(--text_light); }
QPushButton:hover { border-color: var(--primary_light); background: var(--button_bg_hover); }
QPushButton:focus, QComboBox:focus, QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus {
    border-color: var(--primary);
}
.button-primary { background: var(--primary_dark); border-color: var(--primary_dark); color: white; }
.button-primary:hover, .button-primary:focus { background: var(--primary_darker); border-color: var(--primary); color: white; }
.button-primary:disabled { background: var(--button_bg_disabled); border-color: var(--border_color); color: var(--text_disabled); }
QTabBar::tab { border-radius: 10px; margin: 4px 3px; padding: 7px 12px; color: var(--text_muted); }
QTabBar::tab:selected { background: var(--button_bg); color: var(--selection_text); border: 2px solid var(--primary); padding: 6px 11px; }
QTabBar::tab:hover { background: var(--selection_bg); color: var(--selection_text); }
QGroupBox { border-color: var(--border_color); border-radius: 10px; }
QToolBar { background: var(--panel); border: none; border-top: 1px solid var(--border_color); border-radius: 9px; padding: 4px; spacing: 5px; }
QToolButton { border: 1px solid var(--button_border); border-radius: 9px; padding: 5px; background: var(--button_bg); }
QToolButton:hover { background: var(--selection_bg); border-color: var(--primary_light); border-radius: 7px; }
QProgressBar { background: var(--button_bg_disabled); color: var(--text); border-color: var(--border_color); border-radius: 5px; }
QProgressBar::chunk { background: var(--primary); border-radius: 4px; }
#contextContainer, #controlsFrame { background: var(--panel); border-radius: 12px; padding: 7px; }
#controlsFrame QPushButton { margin: 3px 1px; padding: 7px 10px; }
QHeaderView::section { background: var(--button_bg); color: var(--text_muted); border: none; border-bottom: 1px solid var(--border_color); padding: 7px; }
QScrollBar:vertical { background: transparent; width: 9px; margin: 4px 1px; border: none; }
QScrollBar::handle:vertical { background: var(--scrollbar_handle); border-radius: 4px; min-height: 24px; border: none; }
QScrollBar::handle:vertical:hover { background: var(--scrollbar_hover); }
QSlider::groove:horizontal { background: var(--border_color); height: 4px; border: none; border-radius: 2px; }
QSlider::sub-page:horizontal { background: var(--primary); border: none; border-radius: 2px; }
QSlider::handle:horizontal { background: var(--primary); border: 2px solid white; width: 13px; height: 13px; margin: -6px 0; border-radius: 8px; }
QSlider::handle:horizontal:hover { background: var(--primary_dark); }
/* Audio meters, active stream/record controls, errors and source visibility
   retain the semantic behavior supplied by the OBS Light/Yami styles. */
`;
const consoleRules=`
/* Console Glass uses native alpha blending, not browser backdrop blur. */
QMainWindow, OBSBasic {
    background: qlineargradient(x1: 0, y1: 0, x2: 1, y2: 1,
        stop: 0 #66395f, stop: 0.34 #97477f, stop: 0.72 #aa686d, stop: 1 #a78250);
}
QDialog { background: #965b82; }
QDockWidget { background: rgba(255,255,255,21); border: 1px solid rgba(255,255,255,60); border-radius: 23px; }
QDockWidget > QWidget { background: rgba(255,255,255,10); }
QDockWidget::title {
    background: qlineargradient(x1: 0, y1: 0, x2: 1, y2: 0, stop: 0 rgba(255,255,255,25), stop: 1 rgba(255,255,255,10));
    color: #fffaf6; font-size: var(--font_large); font-weight: bold;
    padding: 12px 14px; border: none; border-bottom: 1px solid rgba(255,255,255,40);
    border-top-left-radius: 22px; border-top-right-radius: 22px;
}
QDockWidget::close-button, QDockWidget::float-button { border-radius: 10px; margin-right: 4px; }
QDockWidget::close-button:hover, QDockWidget::float-button:hover { background: rgba(255,255,255,35); }
QMenuBar, QStatusBar { background: rgba(255,255,255,12); color: #f8e0eb; border: none; }
QMenuBar { padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,35); }
QMenuBar::item { padding: 8px 13px; border-radius: 14px; color: #fff6f0; }
QMenuBar::item:selected { background: rgba(255,255,255,35); color: white; }
QMenu { background: #a1688b; color: white; border: 1px solid rgba(255,255,255,90); border-radius: 18px; padding: 9px; }
QMenu::item { padding: 8px 28px; border-radius: 10px; color: white; }
QMenu::item:selected { background: rgba(255,255,255,32); color: white; }
QMenu::item:disabled { color: #cfadbf; }
QToolTip { background: #a1688b; color: white; border: 1px solid rgba(255,255,255,90); border-radius: 10px; padding: 8px 12px; }
QListView, QListWidget, QTreeView, QTableView, QTextEdit, QPlainTextEdit {
    background: transparent; border: none; border-radius: 18px; padding: 7px;
}
QListView::item, QListWidget::item, QTreeView::item, SourceTreeItem {
    background: transparent; border: 2px solid transparent; border-radius: 13px;
    color: #fff9f3; padding: 7px 10px; margin: 3px 2px;
}
QListView::item:hover, QListWidget::item:hover, QTreeView::item:hover {
    background: rgba(255,255,255,15); border: 2px solid rgba(255,255,255,35);
}
QListView::item:selected, QListWidget::item:selected, QTreeView::item:selected,
QListView::item:selected:focus, QListWidget::item:selected:focus, QTreeView::item:selected:focus,
QListView::item:selected:hover, QListWidget::item:selected:hover, QTreeView::item:selected:hover {
    background: rgba(255,255,255,24); border: 2px solid #fff5ec; color: white;
}
QPushButton { background: rgba(255,255,255,26); border: 1px solid rgba(255,255,255,72); border-radius: 16px; color: white; padding: 9px 14px; }
QPushButton:hover { background: rgba(255,255,255,45); border: 1px solid #fff7ef; }
QPushButton:pressed { background: rgba(255,255,255,60); }
QPushButton:disabled { background: rgba(255,255,255,8); border-color: rgba(255,255,255,24); color: #d1afc3; }
.button-primary { background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1, stop: 0 #eb978b, stop: 1 #d87883); border: 1px solid #ffc7b8; color: white; }
.button-primary:hover, .button-primary:focus { background: #ec9d91; border-color: white; color: white; }
.button-primary:disabled { background: rgba(255,255,255,8); color: #d1afc3; border-color: rgba(255,255,255,24); }
QLineEdit, QComboBox, QSpinBox, QDoubleSpinBox { background: rgba(255,255,255,15); border: 1px solid rgba(255,255,255,70); border-radius: 13px; color: white; padding: 9px 12px; }
QLineEdit:focus, QComboBox:focus, QSpinBox:focus, QDoubleSpinBox:focus { background: rgba(255,255,255,25); border-color: white; }
QComboBox QAbstractItemView { background: #a1688b; color: white; selection-background-color: #bb88a4; selection-color: white; }
QTabBar::tab { background: rgba(255,255,255,13); border: 2px solid transparent; border-radius: 15px; padding: 10px 15px; margin: 5px 4px; color: #f3d8e6; }
QTabBar::tab:selected { background: rgba(255,255,255,26); border: 2px solid white; color: white; padding: 10px 15px; }
QTabBar::tab:hover { background: rgba(255,255,255,28); color: white; }
QToolBar { background: rgba(255,255,255,10); border: none; border-top: 1px solid rgba(255,255,255,35); border-radius: 17px; padding: 7px; spacing: 8px; }
QToolButton { background: rgba(255,255,255,25); border: 1px solid rgba(255,255,255,45); border-radius: 15px; padding: 7px; }
QToolButton:hover { background: rgba(255,255,255,45); border-color: white; border-radius: 15px; }
.icon-plus, .icon-minus, .icon-gear, .icon-filter, .icon-up, .icon-down, .icon-dots-vert {
    border-radius: 15px; padding: 7px; border: 1px solid rgba(255,255,255,55);
}
.icon-plus { background: #86b89c; }
.icon-minus { background: #d68f96; }
.icon-gear { background: #c9a171; }
.icon-filter { background: #78aebc; }
.icon-up, .icon-down { background: rgba(255,255,255,24); }
.icon-plus:hover, .icon-minus:hover, .icon-gear:hover, .icon-filter:hover { border-color: white; }
QGroupBox { background: rgba(255,255,255,10); border: 1px solid rgba(255,255,255,35); border-radius: 20px; }
#controlsFrame, #contextContainer { background: rgba(255,255,255,9); border-radius: 20px; padding: 9px; }
#controlsFrame QPushButton { margin: 5px 2px; padding: 10px 12px; border-radius: 17px; }
QHeaderView::section { background: #ac7897; color: white; border: none; padding: 10px; }
QSlider::groove:horizontal { background: rgba(255,255,255,32); border-radius: 3px; height: 5px; }
QSlider::sub-page:horizontal { background: #fff2e9; border-radius: 3px; }
QSlider::handle:horizontal { background: white; border: 2px solid #f9e0d9; width: 12px; height: 12px; border-radius: 7px; margin: -6px 0; }
QSlider::handle:horizontal:hover { background: #ffe4cf; }
QProgressBar { background: rgba(255,255,255,15); border: none; color: white; border-radius: 7px; }
QProgressBar::chunk { background: #fff4ec; border-radius: 7px; }
QScrollBar::handle:vertical { background: rgba(255,255,255,90); border-radius: 4px; }
QMainWindow::separator { width: 11px; height: 11px; }
`;
const consoleRefinement=`
/* Console reference: red navigation, cyan selection, and pearl icon buttons. */
QMainWindow, OBSBasic {
    background: qlineargradient(x1: 0, y1: 0, x2: 1, y2: 1,
        stop: 0 #466a7d, stop: 0.40 #638a96, stop: 0.76 #7f9b91, stop: 1 #b29c7d);
}
QMenuBar {
    background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1, stop: 0 #ff574d, stop: 1 #f5423d);
    border: none; border-bottom: 1px solid rgba(255,255,255,90); padding: 6px 9px;
}
QMenuBar::item { color: white; font-weight: bold; border-radius: 17px; padding: 8px 14px; }
QMenuBar::item:selected { background: rgba(255,255,255,42); color: white; }
QDockWidget { border: 1px solid rgba(255,255,255,70); border-radius: 23px; background: rgba(255,255,255,25); }
QDockWidget::title {
    background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1, stop: 0 rgba(255,255,255,50), stop: 1 rgba(255,255,255,10));
    color: #ffffff; font-size: var(--font_large); font-weight: bold;
    padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,55);
}
QListView::item, QListWidget::item, QTreeView::item, SourceTreeItem {
    border: 3px solid transparent; border-radius: 14px; margin: 4px 3px; padding: 7px 11px;
}
QListView::item:selected, QListWidget::item:selected, QTreeView::item:selected,
QListView::item:selected:focus, QListWidget::item:selected:focus, QTreeView::item:selected:focus,
QListView::item:selected:hover, QListWidget::item:selected:hover, QTreeView::item:selected:hover {
    background: rgba(255,255,255,30); border: 3px solid #39e4d4; color: white;
}
QListView::item:hover, QListWidget::item:hover, QTreeView::item:hover {
    background: rgba(255,255,255,20); border: 3px solid rgba(255,255,255,90);
}
QTabBar::tab:selected { background: rgba(255,255,255,28); border: 3px solid #39e4d4; color: white; padding: 9px 14px; }
QPushButton { border-radius: 18px; border: 1px solid rgba(255,255,255,100); background: rgba(255,255,255,24); }
QPushButton:hover, QPushButton:focus { border-color: #64f0de; background: rgba(255,255,255,40); }
.button-primary {
    background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1, stop: 0 #ff6a59, stop: 1 #f34742);
    border: 1px solid #ffb4a8; color: white; font-weight: bold;
}
.button-primary:hover, .button-primary:focus { background: #ff7161; border: 1px solid white; color: white; }
.button-primary:disabled { background: rgba(255,255,255,10); border-color: rgba(255,255,255,35); color: #c6d8d6; }
QLineEdit:focus, QComboBox:focus, QSpinBox:focus, QDoubleSpinBox:focus { border-color: #4ee7d7; background: rgba(255,255,255,30); }
QComboBox QAbstractItemView, QMenu { background: #6c9299; color: white; border-color: rgba(255,255,255,110); }
QMenu::item:selected { background: rgba(255,255,255,26); color: white; }
QDialog { background: #60858d; }
QHeaderView::section { background: #7c9ca1; color: white; }
QPushButton:disabled, QMenu::item:disabled { color: #bccfd0; }
QToolTip { background: #f9fbf3; color: #49656c; border: 1px solid white; border-radius: 12px; padding: 9px 12px; }
.icon-plus, .icon-minus, .icon-gear, .icon-filter {
    background: qlineargradient(x1: 0, y1: 0, x2: 0, y2: 1, stop: 0 #ffffff, stop: 1 #edf3ea);
    border: 1px solid white; border-radius: 16px;
    padding: 8px; min-width: 16px; min-height: 16px; icon-size: 17px;
}
.icon-plus { qproperty-icon: url(theme:BubblecastConsole/plus.svg); }
.icon-minus { qproperty-icon: url(theme:BubblecastConsole/minus.svg); }
.icon-gear { qproperty-icon: url(theme:BubblecastConsole/gear.svg); }
.icon-filter { qproperty-icon: url(theme:BubblecastConsole/filter.svg); }
.icon-plus:hover, .icon-minus:hover, .icon-gear:hover, .icon-filter:hover {
    background: white; border: 1px solid #3be7d5;
}
QSlider::sub-page:horizontal { background: #69ecd9; }
QSlider::handle:horizontal { background: white; border-color: #ccfff2; }
QSlider::handle:horizontal:hover { background: #e5fff5; }
QStatusBar { color: #f6fff9; background: rgba(255,255,255,12); border-top: 1px solid rgba(255,255,255,40); }
`;
for(const theme of themes){
 const vars=Object.entries({...common,...theme.colors}).map(([key,value])=>`    --${key}: ${value};`).join('\n');
 const text=`@OBSThemeMeta {\n    name: '${theme.name}';\n    id: '${theme.id}';\n    extends: '${theme.extends||'com.obsproject.Yami.Light'}';\n    author: 'Bubblecast';\n    dark: '${theme.dark?'true':'false'}';\n}\n\n@OBSThemeVars {\n${vars}\n}\n${rules}${theme.dark?consoleRules+consoleRefinement:''}`;
 await writeFile(new URL(theme.file,import.meta.url),text);
}
