const SIZE = 10;
const EVENT_TITLE = '莆田第一中学第三届 3099 知识竞赛决赛';
const CREDITS_DEV = 'Dev: [Github] Adehit';
const CREDITS_ARTIST = 'Artist: Mojang';
const CREDITS_ACK = 'Acknowledgement: Linrui, [Github] SkySight-666';

function isValidMap(map) {
    if (!Array.isArray(map) || map.length !== SIZE * SIZE) return false;
    let c1 = 0, c2 = 0, c3 = 0;
    for (let i = 0; i < map.length; i++) {
        if (map[i] === 1) c1++;
        else if (map[i] === 2) c2++;
        else if (map[i] === 3) c3++;
    }
    return c1 === 1 && c2 === 2 && c3 === 3;
}

function readJsonFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (event) {
            try {
                resolve(JSON.parse(event.target.result));
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

var _problems = [];
var _map1 = [];
var _map2 = [];
var _name1 = '';
var _name2 = '';
var continue_error = [0, 0];

var _bullets1 = 0;
var _bullets2 = 0;
var _currentQuestionIndex = -1;
var answeredCnt = -1;
var canAnswer = true;
var lastAnswerSnapshot = null;
var lastAnswerPanel = null;
var lastAnswerChoice = null;
var isQuizAreaVisible = true;
var quizToggleBound = false;
var gameEnded = false;
var winnerName = '';
var healths = [[1, 2, 3], [1, 2, 3]];
const audioPool = new AudioPool(['resources/audio/Water_splash.ogg',
    'resources/audio/Explosion.ogg',
    'resources/audio/correct.mp3',
    'resources/audio/wrong.mp3',
    'resources/audio/preloadEmpty.mp3',
    'resources/audio/Winner_Kun.mp3',]);

function areQuestionsFinished() {
    return _problems.length > 0 && _currentQuestionIndex >= _problems.length;
}

function bothBulletsSpent() {
    return _bullets1 <= 0 && _bullets2 <= 0;
}

function isQuizLocked() {
    return gameEnded || areQuestionsFinished();
}

function enterSettleWait(name) {
    gameEnded = true;
    winnerName = name || '平局';
    canAnswer = false;
    lastAnswerSnapshot = null;
    setQuizAreaVisible(false);
    updateRoundDisplay();
    saveAllData();
}

function closeQuizAfterQuestions() {
    canAnswer = false;
    lastAnswerSnapshot = null;
    setQuizAreaVisible(false);
    updateRoundDisplay();
    saveAllData();
}

function tryEnterDrawSettle(notify) {
    if (gameEnded || !areQuestionsFinished() || !bothBulletsSpent()) {
        return false;
    }
    enterSettleWait('平局');
    if (notify) {
        cocoMessage.warning("双方炮弹已经用完，请点击结算。");
    }
    return true;
}

function finishQuestionsIfNeeded(notify) {
    if (!areQuestionsFinished()) {
        return false;
    }
    if (gameEnded) {
        setQuizAreaVisible(false);
        return true;
    }
    closeQuizAfterQuestions();
    if (tryEnterDrawSettle(false)) {
        if (notify) {
            cocoMessage.warning("题库的题目已经全部问完，请点击结算。");
        }
    } else if (notify) {
        cocoMessage.warning("题库的题目已经全部问完，请打完剩余炮弹后再结算。");
    }
    return true;
}

function isOver() {
    // 判断游戏是否结束
    if (gameEnded) { return true; }
    if (healths[0].every(item => item <= 0)) {
        enterSettleWait(_name2);
    } else if (healths[1].every(item => item <= 0)) {
        enterSettleWait(_name1);
    }
    return gameEnded;
}

function generateQuestion() {
    // 下一题
    if (_problems.length === 0) {
        canAnswer = false;
        cocoMessage.error("题库中没有题目！");
        updateRoundDisplay();
        return;
    }
    if (finishQuestionsIfNeeded(true)) {
        return;
    }
    const question = _problems[_currentQuestionIndex];
    document.getElementById('question-content').innerHTML = formatQuestion(question.content);
    updateOptions(question);
    updateRoundDisplay();
    const quizArea = document.querySelector('.quiz-area');
    waitForQuestionMedia(quizArea, function () {
        funTransitionHeight(quizArea);
    });
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;');
}

function wrapPlainText(text) {
    const escaped = escapeHtml(text).replace(/\r\n|\r|\n/g, '<br>');
    return escaped.replace(/\d+/g, '<span class="plain-digit">$&</span>');
}

function renderLatex(tex, displayMode) {
    if (typeof katex === 'undefined') {
        return '<span class="latex-error">' + wrapPlainText(tex) + '</span>';
    }
    try {
        return katex.renderToString(tex, {
            displayMode: !!displayMode,
            throwOnError: false,
            strict: 'ignore',
            trust: false,
            output: 'html'
        });
    } catch (e) {
        return '<span class="latex-error">' + wrapPlainText(tex) + '</span>';
    }
}

function isProblemImageName(name) {
    return /^[A-Za-z0-9_\-]+\.[A-Za-z0-9]+$/.test(name);
}

function renderProblemImage(name) {
    const safeName = encodeURIComponent(name);
    return '<img class="question-image" src="resources/img/problems/' + safeName + '" alt="' + escapeHtml(name) + '">';
}

function extractImageAndLatexSegments(content) {
    const source = String(content == null ? '' : content);
    const imagePattern = /!\?([A-Za-z0-9_\-]+\.[A-Za-z0-9]+)\?!/g;
    const chunks = [];
    let lastIndex = 0;
    let match;
    while ((match = imagePattern.exec(source)) !== null) {
        if (!isProblemImageName(match[1])) {
            continue;
        }
        if (match.index > lastIndex) {
            chunks.push({ type: 'text', value: source.slice(lastIndex, match.index) });
        }
        chunks.push({ type: 'image', value: match[1] });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < source.length) {
        chunks.push({ type: 'text', value: source.slice(lastIndex) });
    }
    const segments = [];
    chunks.forEach(function (chunk) {
        if (chunk.type === 'image') {
            segments.push(chunk);
        } else {
            extractLatexSegments(chunk.value).forEach(function (segment) {
                segments.push(segment);
            });
        }
    });
    return segments;
}

function extractLatexSegments(content) {
    const source = String(content == null ? '' : content);
    const segments = [];
    const pattern = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\begin\{([^}]+)\}([\s\S]+?)\\end\{\3\}|\$((?:\\.|[^$\\])+)\$|\\\(([\s\S]+?)\\\)/g;
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ type: 'text', value: source.slice(lastIndex, match.index) });
        }
        if (match[1] != null) {
            segments.push({ type: 'math', display: true, value: match[1] });
        } else if (match[2] != null) {
            segments.push({ type: 'math', display: true, value: match[2] });
        } else if (match[3] != null) {
            segments.push({ type: 'math', display: true, value: '\\begin{' + match[3] + '}' + match[4] + '\\end{' + match[3] + '}' });
        } else if (match[5] != null) {
            segments.push({ type: 'math', display: false, value: match[5] });
        } else {
            segments.push({ type: 'math', display: false, value: match[6] });
        }
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < source.length) {
        segments.push({ type: 'text', value: source.slice(lastIndex) });
    }
    return segments;
}

function formatQuestionContent(content, allowImages) {
    const segments = allowImages ? extractImageAndLatexSegments(content) : extractLatexSegments(content);
    const textHtml = [];
    const imageHtml = [];
    segments.forEach(function (segment) {
        if (segment.type === 'image') {
            if (allowImages) {
                imageHtml.push(renderProblemImage(segment.value));
            }
            return;
        }
        if (segment.type === 'math') {
            textHtml.push(renderLatex(segment.value, segment.display));
            return;
        }
        textHtml.push(wrapPlainText(segment.value));
    });
    return textHtml.join('') + imageHtml.join('');
}

function formatQuestion(content) {
    return formatQuestionContent(content, true);
}

function formatChoice(content) {
    return formatQuestionContent(content, false);
}

function shuffleQuestions() {
    // 打乱题库顺序
    for (let i = _problems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [_problems[i], _problems[j]] = [_problems[j], _problems[i]];
    }
}

function saveAllData() {
    const data = {
        name1: _name1,
        name2: _name2,
        map1: _map1,
        map2: _map2,
        bullets1: _bullets1,
        bullets2: _bullets2,
        healths: healths,
        problems: _problems,
        currentQuestionIndex: _currentQuestionIndex,
        continue_error: continue_error,
        answeredCnt: answeredCnt,
        canAnswer: canAnswer,
        lastAnswerSnapshot: lastAnswerSnapshot,
        lastAnswerPanel: lastAnswerPanel,
        lastAnswerChoice: lastAnswerChoice,
        gameEnded: gameEnded,
        winnerName: winnerName
    };
    localStorage.setItem('quizData', JSON.stringify(data));
}

function loadAllData() {
    const data = localStorage.getItem('quizData');
    if (data) {
        const parsedData = JSON.parse(data);
        _name1 = parsedData.name1;
        _name2 = parsedData.name2;
        _map1 = parsedData.map1;
        _map2 = parsedData.map2;
        _bullets1 = parsedData.bullets1;
        _bullets2 = parsedData.bullets2;
        healths = parsedData.healths;
        _problems = parsedData.problems;
        _currentQuestionIndex = parsedData.currentQuestionIndex;
        continue_error = parsedData.continue_error;
        answeredCnt = parsedData.answeredCnt;
        lastAnswerSnapshot = parsedData.lastAnswerSnapshot || null;
        lastAnswerPanel = parsedData.lastAnswerPanel || null;
        lastAnswerChoice = parsedData.lastAnswerChoice || null;
        gameEnded = !!parsedData.gameEnded;
        winnerName = parsedData.winnerName || '';
        if (gameEnded) {
            canAnswer = false;
        } else if (parsedData.canAnswer !== undefined) {
            canAnswer = parsedData.canAnswer;
        } else {
            canAnswer = !lastAnswerChoice;
        }
        return true;
    } else {
        return false;
    }
}

function startGameLocally() {
    if (!loadAllData()) {
        cocoMessage.error("本地数据不存在！");
        return;
    }
    audioPool.playSound("resources/audio/preloadEmpty.mp3");
    const settingsMenu = document.querySelector('.settings-menu');
    settingsMenu.style.display = 'none';
    const starting = document.querySelector('.starting');
    starting.style.display = 'flex';
    document.body.style.cursor = 'none';
    $(".team-name1").text(_name1);
    $(".team-name2").text(_name2);
    updateRoundDisplay();
    setTimeout(() => {
        $(".starting").children().fadeIn(1000);
    }, 500);
    setTimeout(() => {
        $(".starting").children().fadeOut(1000);
    }, 4000);
    setTimeout(() => {
        $(".starting").fadeOut(1000);
        const gameBoard = document.querySelector('.container');
        gameBoard.style.opacity = 1;
        gameBoard.style.pointerEvents = 'auto';
        const quizArea = document.querySelector('.quiz-area');
        quizArea.style.opacity = 1;
        quizArea.style.pointerEvents = 'auto';
        document.body.style.cursor = 'default';
        updateBulletsDisplay();
        updateHealthDisplay();
        updateMapDisplay('left-panel');
        updateMapDisplay('right-panel');
        if (!finishQuestionsIfNeeded(false) && _currentQuestionIndex >= 0 && !gameEnded) {
            generateQuestion();
            restoreAnswerVisual();
        }
        enableQuizPanelToggle();
    }, 5000);
}

function confirmClearAllData() {
    const overlay = document.getElementById('clear-cache-confirm');
    if (overlay) { overlay.style.display = 'flex'; }
}

function closeClearConfirm() {
    const overlay = document.getElementById('clear-cache-confirm');
    if (overlay) { overlay.style.display = 'none'; }
}

function clearAllData() {
    localStorage.removeItem('quizData');
    location.reload();
}

function chooseAnswer(ele, panel) {
    if (gameEnded) { return; }
    if (!ele.dataset.choice || _currentQuestionIndex === -1 || _currentQuestionIndex >= _problems.length) { return; }
    if (canAnswer) {
        lastAnswerSnapshot = {
            bullets1: _bullets1,
            bullets2: _bullets2,
            continue_error: continue_error.slice()
        };
        canAnswer = false;
    } else if (lastAnswerSnapshot) {
        _bullets1 = lastAnswerSnapshot.bullets1;
        _bullets2 = lastAnswerSnapshot.bullets2;
        continue_error = lastAnswerSnapshot.continue_error.slice();
        answeredCnt--;
        $(".choice").removeClass('correct wrong correct-not-selected');
    } else {
        return;
    }
    const question = _problems[_currentQuestionIndex];
    const _name = panel === 'left-panel' ? _name1 : _name2;
    const _opponentName = panel === 'left-panel' ? _name2 : _name1;
    continue_error[panel === 'left-panel' ? 1 : 0] = 0;
    if (ele.dataset.choice === question.ans) {
        audioPool.playSound("resources/audio/correct.mp3");
        continue_error[panel === 'left-panel' ? 0 : 1] = 0;
        cocoMessage.success(`【${_name}】回答正确！获得 1 个炮弹。`);
        ele.classList.add('correct');
        if (panel === 'left-panel') {
            _bullets1++;
        } else {
            _bullets2++;
        }
    } else {
        audioPool.playSound("resources/audio/wrong.mp3");
        continue_error[panel === 'left-panel' ? 0 : 1]++;
        if (continue_error[panel === 'left-panel' ? 0 : 1] >= 2) {
            cocoMessage.error(`【${_name}】回答错误！【${_opponentName}】获得 1 个炮弹。`);
            if (panel === 'left-panel') {
                _bullets2++;
            } else {
                _bullets1++;
            }
        } else {
            cocoMessage.error(`【${_name}】回答错误！`);
        }
        ele.classList.add('wrong');
        $(`.choice[data-choice="${question.ans}"]`).addClass('correct-not-selected');
    }
    lastAnswerPanel = panel;
    lastAnswerChoice = ele.dataset.choice;
    answeredCnt++;
    updateBulletsDisplay();
    updateRoundDisplay();
    saveAllData();
}

function restoreAnswerVisual() {
    if (canAnswer || !lastAnswerChoice || !lastAnswerPanel) { return; }
    if (_currentQuestionIndex < 0 || _currentQuestionIndex >= _problems.length) { return; }
    const question = _problems[_currentQuestionIndex];
    const ele = document.querySelector(`.player-panel.${lastAnswerPanel} .choice[data-choice="${lastAnswerChoice}"]`);
    if (!ele) { return; }
    if (lastAnswerChoice === question.ans) {
        ele.classList.add('correct');
    } else {
        ele.classList.add('wrong');
        $(`.choice[data-choice="${question.ans}"]`).addClass('correct-not-selected');
    }
}

function updateBulletsDisplay() {
    document.getElementById('bullets1').dataset.number = _bullets1;
    document.getElementById('bullets2').dataset.number = _bullets2;
}

function nextQuestion() {
    if (gameEnded) { return; }
    if (_currentQuestionIndex >= _problems.length) {
        finishQuestionsIfNeeded(true);
        return;
    }
    canAnswer = true;
    lastAnswerSnapshot = null;
    lastAnswerPanel = null;
    lastAnswerChoice = null;
    $(".choice").each(function () {
        $(this).removeClass('correct wrong correct-not-selected');
    });
    _currentQuestionIndex++;
    generateQuestion();
    saveAllData();
}

function skipQuestion() {
    if (gameEnded) { return; }
    if (_currentQuestionIndex === -1) {
        cocoMessage.warning("还没有开始答题！");
        return;
    }
    nextQuestion();
}

function updateOptions(question) {
    ['A', 'B', 'C', 'D'].forEach(option => {
        document.getElementById(`cc-${option}`).innerHTML = formatChoice(question[option]);
    });
}

//通过键盘实现fire()开火，先按下A/B选择面板，再按下横纵向坐标
var nowChoosePanel = '';
var nowChoosePos = [-1, -1];
function refreshMaps() {
    updateMapDisplay('left-panel');
    updateMapDisplay('right-panel');
    const name1 = document.querySelector('.status-bar .team-name1');
    const name2 = document.querySelector('.status-bar .team-name2');
    if (name1) { name1.classList.toggle('team-selected', nowChoosePanel === 'A'); }
    if (name2) { name2.classList.toggle('team-selected', nowChoosePanel === 'B'); }
}
document.onkeydown = function (event) {
    if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable)) {
        return;
    }
    if (event.key === 'a' || event.key === 'A') {
        nowChoosePanel = 'A';
        nowChoosePos = [-1, -1];
        refreshMaps();
    } else if (event.key === 'b' || event.key === 'B') {
        nowChoosePanel = 'B';
        nowChoosePos = [-1, -1];
        refreshMaps();
    } else if ((event.key <= '9' && event.key >= '1') || event.key === '0') {
        if (nowChoosePanel === '') { return; }
        const pos = event.key === '0' ? 9 : parseInt(event.key) - 1;
        if (nowChoosePos[0] === -1) {
            nowChoosePos[0] = pos;
        } else {
            nowChoosePos[1] = pos;
        }
        refreshMaps();
    } else if (event.key === 'Enter') {
        if (nowChoosePos[0] >= 0 && nowChoosePos[1] >= 0 && nowChoosePanel != '') {
            const panel = nowChoosePanel === 'A' ? 'left-panel' : 'right-panel';
            const x = nowChoosePos[0];
            const y = nowChoosePos[1];
            fire(panel, x, y);
            nowChoosePos = [-1, -1];
            nowChoosePanel = '';
            refreshMaps();
        }
    } else if (event.key === 'Backspace') {
        if (nowChoosePos[1] !== -1) {
            nowChoosePos[1] = -1;
        } else if (nowChoosePos[0] !== -1) {
            nowChoosePos[0] = -1;
        } else {
            nowChoosePanel = '';
        }
        refreshMaps();
    }
}

//开火
function settleGame() {
    if (!gameEnded) { return; }
    Winner(winnerName);
}

function fire(panel, x, y) {
    const isLeftPanel = panel === 'left-panel';
    let mapData, opponentName, selfName;

    if (isLeftPanel) {
        mapData = _map1;
        opponentName = _name1;
        selfName = _name2;
    } else {
        mapData = _map2;
        opponentName = _name2;
        selfName = _name1;
    }
    if ((isLeftPanel ? _bullets2 : _bullets1) <= 0) {
        cocoMessage.error(`【${selfName}】炮弹已经用完！`);
        return;
    }

    const width = SIZE;
    const index = parseInt(y) * width + parseInt(x);
    if (![0, 1, 2, 3].includes(mapData[index])) {
        cocoMessage.warning(`【${selfName}】该位置已经开过火了！`);
        return;
    }
    if (isLeftPanel) { _bullets2--; } else { _bullets1--; }
    if (mapData[index] === 0) {
        audioPool.playSound("resources/audio/Water_splash.ogg");
        cocoMessage.info(`【${selfName}】的炮弹没有击中任何东西！`);
        mapData[index] = -7;
    } else if (mapData[index] === 1 || mapData[index] === 2 || mapData[index] === 3) {
        audioPool.playSound("resources/audio/Explosion.ogg");
        cocoMessage.success(2000, `【${selfName}】的炮弹击中了【${opponentName}】的${mapData[index]}号舰船！`);
        healths[panel === 'left-panel' ? 0 : 1][mapData[index] - 1]--;
        mapData[index] = -mapData[index];
        isOver();
    }

    nowChoosePanel = '';
    nowChoosePos = [-1, -1];
    updateHealthDisplay();
    updateBulletsDisplay();
    refreshMaps();
    if (!gameEnded) {
        tryEnterDrawSettle(true);
    }
    saveAllData();
}

// 更新轮数显示
function updateRoundDisplay() {
    const roundInfo = document.querySelector('.game-title .round-info');
    const settleBtn = document.querySelector('.settle-button');
    if (gameEnded) {
        if (roundInfo) { roundInfo.style.display = 'none'; }
        if (settleBtn) { settleBtn.style.display = 'inline-flex'; }
    } else {
        if (roundInfo) { roundInfo.style.display = ''; }
        if (settleBtn) { settleBtn.style.display = 'none'; }
    }
    const questionNo = _currentQuestionIndex < 0 ? 0 : _currentQuestionIndex + 1;
    $(".round-number").text(`${parseInt(questionNo === 0 ? 0 : (questionNo - 1) / 5 + 1)}`);
    $(".round-inside-cnt").text(questionNo === 0 ? 0 : (questionNo - 1) % 5 + 1);
    $(".remaining-cnt").text(Math.max(0, _problems.length - questionNo));
}

// 更新血量显示
function updateHealthDisplay() {
    for (let i = 1; i <= 2; ++i) {
        for (let j = 1; j <= 3; ++j) {
            $(`#health${i}-${j}`).html('');
            for (let k = 1; k <= healths[i - 1][j - 1]; ++k) {
                $(`#health${i}-${j}`).append(`<img src="resources/img/health_1.png" alt="health">`);
            }
        }
    }
}

// 更新地图显示
function updateMapDisplay(panel) {
    const isLeftPanel = panel === 'left-panel';
    let mapData;
    if (isLeftPanel) {
        mapData = _map1;
    } else {
        mapData = _map2;
    }

    const grid = document.querySelector(`.${panel}`);
    const isThisPanel = nowChoosePanel === (panel === 'left-panel' ? 'A' : 'B');
    for (let i = 0; i < SIZE * SIZE; i++) {
        const square = grid.children[i];
        if ([0, 1, 2, 3].includes(mapData[i])) {
            square.src = 'resources/img/cloud.png';
        } else if ([-1, -2, -3].includes(mapData[i])) {
            square.src = `resources/img/boat${Math.abs(mapData[i])}_hit.gif`;
            if (square.onclick) {
                square.onclick = null;
                square.style.cursor = 'not-allowed';
            }
        } else if (mapData[i] === -7) {
            square.src = 'resources/img/empty.png';
            if (square.onclick) {
                square.onclick = null;
                square.style.cursor = 'not-allowed';
            }
        } else {
            square.src = 'resources/img/cloud.png';
        }
        const x = i % SIZE;
        const y = parseInt(i / SIZE);
        square.classList.remove('selected-square', 'selected-col');
        if (!isThisPanel) { continue; }
        if (nowChoosePos[0] >= 0 && nowChoosePos[1] >= 0 && x === nowChoosePos[0] && y === nowChoosePos[1]) {
            square.classList.add('selected-square');
        } else if (nowChoosePos[0] >= 0 && nowChoosePos[1] === -1 && x === nowChoosePos[0]) {
            square.classList.add('selected-col');
        }
    }
}

function generateGrid(width, height, panelClass) {
    const grid = document.querySelector(`.${panelClass}`);
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const square = document.createElement('img');
            if (panelClass === 'left-panel' || panelClass === 'right-panel') {
                square.src = 'resources/img/cloud.png';
                square.onclick = function () { fire(panelClass, this.dataset.x, this.dataset.y); };
                square.dataset.x = j;
                square.dataset.y = i;
                square.style.cursor = 'pointer';
            } else {
                square.src = 'resources/img/empty.png';
            }
            square.className = 'square';
            square.ondragstart = function () { return false; };
            grid.appendChild(square);
        }
    }
}

function settings() {
    const settingsMenu = document.querySelector('.settings-menu');
    settingsMenu.style.display = 'flex';
    const startMenu = document.querySelector('.start-menu');
    startMenu.style.display = 'none';
    document.body.style.cursor = 'default';
    document.querySelector('#name1').value = _name1;
    document.querySelector('#name2').value = _name2;
}

function closeSettings() {
    const settingsMenu = document.querySelector('.settings-menu');
    settingsMenu.style.display = 'none';
    const startMenu = document.querySelector('.start-menu');
    startMenu.style.display = 'flex';
    document.body.style.cursor = 'default';
}

function saveSettings() {
    const name1 = document.querySelector('#name1').value;
    const name2 = document.querySelector('#name2').value;
    const quizFile = document.querySelector("#quiz-input").files[0];
    const map1File = document.querySelector("#map1-input").files[0];
    const map2File = document.querySelector("#map2-input").files[0];
    if (name1 == "" || name2 == "") { cocoMessage.warning("双方队名未成功配置！"); return; }
    if (!quizFile) { cocoMessage.warning("题库文件未成功读取！"); return; }
    if (!map1File) { cocoMessage.warning("舰队布局 1 未成功读取！"); return; }
    if (!map2File) { cocoMessage.warning("舰队布局 2 未成功读取！"); return; }
    Promise.all([readJsonFile(quizFile), readJsonFile(map1File), readJsonFile(map2File)]).then(function (data) {
        if (!Array.isArray(data[0]) || !isValidMap(data[1]) || !isValidMap(data[2])) {
            cocoMessage.error("文件格式不正确");
            return;
        }
        _name1 = name1;
        _name2 = name2;
        _problems = data[0];
        _map1 = data[1];
        _map2 = data[2];
        cocoMessage.success("配置成功！");
        closeSettings();
    }).catch(function () {
        cocoMessage.error("文件格式不正确");
    });
}

function startGame() {
    if (_name1 == "" || _name2 == "") {
        cocoMessage.error("还未配置双方名称");
        return;
    } else if (_problems.length == 0) {
        cocoMessage.error("还未配置题库");
        return;
    } else if (_map1.length == 0 || _map2.length == 0) {
        cocoMessage.error("还未配置双方舰队布局");
        return;
    } else if (!isValidMap(_map1) || !isValidMap(_map2)) {
        cocoMessage.error("文件格式不正确");
        return;
    }
    shuffleQuestions();
    audioPool.playSound("resources/audio/preloadEmpty.mp3");
    _currentQuestionIndex = -1;
    const startMenu = document.querySelector('.start-menu');
    startMenu.style.display = 'none';
    const starting = document.querySelector('.starting');
    starting.style.display = 'flex';
    document.body.style.cursor = 'none';
    $(".team-name1").text(_name1);
    $(".team-name2").text(_name2);
    updateRoundDisplay();
    setTimeout(() => {
        $(".starting").children().fadeIn(1000);
    }, 500);
    setTimeout(() => {
        $(".starting").children().fadeOut(1000);
    }, 4000);
    setTimeout(() => {
        $(".starting").fadeOut(1000);
        const gameBoard = document.querySelector('.container');
        gameBoard.style.opacity = 1;
        gameBoard.style.pointerEvents = 'auto';
        const quizArea = document.querySelector('.quiz-area');
        quizArea.style.opacity = 1;
        quizArea.style.pointerEvents = 'auto';
        document.body.style.cursor = 'default';
        updateBulletsDisplay();
        updateHealthDisplay();
        enableQuizPanelToggle();
    }, 5000);
}

function bindFilePickers() {
    document.querySelectorAll('.file-field input[type="file"]').forEach(function (input) {
        input.addEventListener('change', function () {
            const nameEl = input.closest('.file-field').querySelector('.file-name');
            if (!nameEl) { return; }
            if (input.files && input.files[0]) {
                nameEl.textContent = input.files[0].name;
                nameEl.classList.add('selected');
            } else {
                nameEl.textContent = '未选择';
                nameEl.classList.remove('selected');
            }
        });
    });
}

function init() {
    const statusBar = document.querySelector('.status-bar');
    const gameBoard = document.querySelector('.game-board');
    statusBar.style.width = `${gameBoard.clientWidth}px`;
    cocoMessage.config({ duration: 1000 })
    document.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        if (!quizToggleBound) { return; }
        toggleQuizArea();
    });
    const eventTitle = document.getElementById('event-title');
    if (eventTitle) { eventTitle.textContent = EVENT_TITLE; }
    document.querySelectorAll('.credit-dev').forEach(function (el) { el.textContent = CREDITS_DEV; });
    document.querySelectorAll('.credit-artist').forEach(function (el) { el.textContent = CREDITS_ARTIST; });
    document.querySelectorAll('.credit-ack').forEach(function (el) { el.textContent = CREDITS_ACK; });
    bindFilePickers();
}

function setQuizAreaVisible(visible) {
    const quizArea = document.querySelector('.quiz-area');
    if (!quizArea) { return; }
    if (isQuizLocked()) { visible = false; }
    isQuizAreaVisible = !!visible;
    quizArea.classList.toggle('quiz-area-hidden', !isQuizAreaVisible);
    quizArea.style.transform = isQuizAreaVisible ? 'translateY(0)' : 'translateY(-100%)';
    quizArea.style.pointerEvents = isQuizAreaVisible ? 'auto' : 'none';
}

function toggleQuizArea() {
    if (isQuizLocked()) { return; }
    const quizArea = document.querySelector('.quiz-area');
    if (!quizArea || quizArea.style.opacity === '0') { return; }
    setQuizAreaVisible(!isQuizAreaVisible);
}

function enableQuizPanelToggle() {
    quizToggleBound = true;
    setQuizAreaVisible(!isQuizLocked());
}

function generateLeftRightGrid() {
    generateGrid(SIZE, SIZE, 'left-panel');
    generateGrid(SIZE, SIZE, 'right-panel');
}

function generateMiddleGrid() {
    generateGrid(4, SIZE, 'middle-panel');
}

/**
 * 实现有动画的DIV高度过渡
 * @param {HTMLDivElement} element 
 * @returns null
 */
function waitForQuestionMedia(root, done) {
    const finish = function () {
        requestAnimationFrame(function () {
            requestAnimationFrame(done);
        });
    };
    const imgs = root ? Array.prototype.slice.call(root.querySelectorAll('img')) : [];
    if (!imgs.length) { finish(); return; }
    let left = imgs.length;
    const tick = function () {
        left--;
        if (left <= 0) { finish(); }
    };
    imgs.forEach(function (img) {
        if (img.complete) { tick(); return; }
        img.addEventListener('load', tick, { once: true });
        img.addEventListener('error', tick, { once: true });
    });
}

var funTransitionHeight = function (element) {
    if (!element || typeof window.getComputedStyle == "undefined") return;
    let height = window.getComputedStyle(element).height;
    element.style.height = "auto";
    let targetPx = element.scrollHeight;
    const computedPx = parseFloat(window.getComputedStyle(element).height);
    if (!isNaN(computedPx) && computedPx > targetPx) {
        targetPx = computedPx;
    }
    element.style.height = height;
    element.offsetWidth = element.offsetWidth;
    element.style.height = targetPx + "px";
};

function fireworks(duration = 15 * 1000) {
    var animationEnd = Date.now() + duration;
    var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    var interval = setInterval(function () {
        var timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        var particleCount = 50 * (timeLeft / duration);
        // since particles fall down, start a bit higher than random
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 750);
}

function schoolPride(duration = 15 * 1000) {
    var end = Date.now() + duration;

    // go Buckeyes!
    var colors = ["#FF4136", "#FF851B", '#FFFFFF', "#FF4136", "#FF851B", '#FFFFFF'];

    (function frame() {
        confetti({
            particleCount: 6,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: colors
        });
        confetti({
            particleCount: 6,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: colors
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

var victoryPlaying = false;
function playVictoryShow() {
    if (victoryPlaying) { return; }
    victoryPlaying = true;
    schoolPride(84000);
    audioPool.playSound("resources/audio/Winner_Kun.mp3", function () {
        victoryPlaying = false;
    });
}

function Winner(name) {
    const isDraw = !name || name === '平局';
    const options1 = {
        strings: [
            isDraw ? '比&emsp;赛&emsp;结&emsp;果' : '胜&emsp;利&emsp;者&emsp;是'
        ],
        typeSpeed: 50,
        startDelay: 0,
        showCursor: false,
        loop: false
    };
    const options2 = {
        strings: [
            isDraw ? '平局' : name
        ],
        typeSpeed: 50,
        startDelay: 500,
        showCursor: false,
        loop: false
    };
    $(".menu").fadeOut(1000);
    $(".container").fadeOut(1000);
    document.querySelector('.quiz-area').style.transform = `translateY(-100%)`;
    $(".game-over").fadeOut(1000);
    setTimeout(() => {
        $(".quiz-area").fadeOut(0);
        $(".game-over").fadeIn(1000);
        playVictoryShow();
    }, 1000);
    setTimeout(() => {
        const typed1 = new Typed("#typed-1", options1);
        const typed2 = new Typed("#typed-2", options2);
    }, 2000);
    const gameOver = document.querySelector('.game-over');
    gameOver.onclick = function () {
        playVictoryShow();
    };
}

generateLeftRightGrid();
generateMiddleGrid();