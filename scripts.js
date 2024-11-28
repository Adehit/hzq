const SIZE = 10;

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
var isQuizAreaVisible = true;
var healths = [[1, 2, 3], [1, 2, 3]];
const audioPool = new AudioPool(['resources/audio/Water_Splash.ogg',
    'resources/audio/Explosion.ogg',
    'resources/audio/correct.mp3',
    'resources/audio/wrong.mp3',
    'resources/audio/preloadEmpty.mp3',
    'resources/audio/Winner_Kun.mp3',]);

function isOver() {
    let isOver = false;
    let winnerName = '';
    if (healths[0].every(item => item === 0)) {
        isOver = true;
        winnerName = _name2;
    } else if (healths[1].every(item => item === 0)) {
        isOver = true;
        winnerName = _name1;
    }
    if (isOver) {
        setTimeout(() => {
            Winner(winnerName);
        }, 2000);
    }
}

function updateBulletsDisplay() {
    document.getElementById('bullets1').dataset.number = _bullets1;
    document.getElementById('bullets2').dataset.number = _bullets2;
}

function generateQuestion() {
    if (_problems.length === 0) {
        cocoMessage.error("题库中没有题目！");
        return;
    }
    if (_currentQuestionIndex >= _problems.length) {
        cocoMessage.warning("题库的题目已经全部问完。");
        return;
    }
    const question = _problems[_currentQuestionIndex];
    document.getElementById('question-content').innerHTML = formatQuestion(question.content);
    funTransitionHeight(document.querySelector('.quiz-area'));
    updateOptions(question);
}

function formatQuestion(content) {
    const highPixel = '<span style="font-family:\'high-pixel\';">$&</span>';
    const escapeChar = {
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#39;',
        '`': '&#96;'
    };
    const escapeCharRegex = new RegExp(`[${Object.keys(escapeChar).join('')}]`, 'g');
    const escapedContent = content.replace(escapeCharRegex, (match) => escapeChar[match]);
    const contentWithHighPixel = escapedContent.replace(/\d+/g, highPixel);
    return contentWithHighPixel;
}

function shuffleQuestions() {
    for (let i = _problems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [_problems[i], _problems[j]] = [_problems[j], _problems[i]]; // 交换元素
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
        answeredCnt: answeredCnt
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
    $("#question-content").text("继续答题");
    $(".choice-content").text("继续答题");
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
        canAnswer = false;
    }, 5000);
    setTimeout(() => {
        document.querySelector("body").oncontextmenu = e => {
            e.preventDefault();
            document.querySelector('.quiz-area').style.transform = `translateY(${!isQuizAreaVisible ? 0 : "-100%"})`;
            isQuizAreaVisible ^= 1;
        }
    }, 6000)
}

function clearAllData() {
    localStorage.removeItem('quizData');
    location.reload();
}

function chooseAnswer(ele, panel) {
    if (!canAnswer || !ele.dataset.choice || _currentQuestionIndex === -1) { return; }
    canAnswer = false;
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
    answeredCnt++;
    updateBulletsDisplay();
    updateRoundDisplay();
    saveAllData();
}

function nextQuestion() {
    canAnswer = true;
    $(".choice").each(function () {
        $(this).removeClass('correct wrong correct-not-selected');
    });
    _currentQuestionIndex++;
    generateQuestion();
}

function skipQuestion() {
    if (_currentQuestionIndex === -1) {
        cocoMessage.warning("还没有开始答题！");
        return;
    }
    nextQuestion();
}

function updateOptions(question) {
    ['A', 'B', 'C', 'D'].forEach(option => {
        document.getElementById(`cc-${option}`).innerHTML = formatQuestion(question[option]);
    });
}

//通过键盘实现fire()开火，先按下A/B选择面板，再按下横纵向坐标
var nowChoosePanel = '';
var nowChoosePos = [-1, -1];
document.onkeydown = function (event) {
    if (event.key === 'a' || event.key === 'A') {
        nowChoosePanel = 'A';
    } else if (event.key === 'b' || event.key === 'B') {
        nowChoosePanel = 'B';
    } else if (event.key <= '9' && event.key >= '1') {
        if (nowChoosePos[0] === -1) {
            nowChoosePos[0] = parseInt(event.key) - 1;
        } else {
            nowChoosePos[1] = parseInt(event.key) - 1;
        }
        updateMapDisplay('left-panel');
        updateMapDisplay('right-panel');
    } else if (event.key === 'Enter') {
        if (nowChoosePos[0] >= 0 && nowChoosePos[1] >= 0 && nowChoosePanel != '') {
            const panel = nowChoosePanel === 'A' ? 'left-panel' : 'right-panel';
            const x = nowChoosePos[0];
            const y = nowChoosePos[1];
            fire(panel, x, y);
            nowChoosePos = [-1, -1];
            nowChoosePanel = '';
        }
    } else if (event.key === 'Backspace') {
        nowChoosePos = [-1, -1];
        nowChoosePanel = '';
        updateMapDisplay('left-panel');
        updateMapDisplay('right-panel');
    }
}

//开火
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
    if (isLeftPanel) { _bullets2--; } else { _bullets1--; }
    if (mapData[index] === 0) {
        audioPool.playSound("resources/audio/Water_Splash.ogg");
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
    updateMapDisplay(panel);
    saveAllData();
}

// 更新轮数显示
function updateRoundDisplay() {
    $(".round-number").text(`${parseInt(answeredCnt === -1 ? 0 : answeredCnt / 5 + 1)}`);
    $(".round-inside-cnt").text(answeredCnt === -1 ? 0 : answeredCnt % 5 + 1);
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
        if (nowChoosePanel === (panel === 'left-panel' ? 'A' : 'B') && i % SIZE === nowChoosePos[0] && parseInt(i / SIZE) === nowChoosePos[1]) {
            square.classList.add('selected-square');
        } else {
            square.classList.remove('selected-square');
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
    let saveSuccess = true;
    _name1 = document.querySelector('#name1').value;
    _name2 = document.querySelector('#name2').value;
    if (_name1 == "" || _name2 == "") { saveSuccess = false; cocoMessage.warning("双方队名未成功配置！"); }
    const file = document.querySelector("#quiz-input").files[0];
    if (file) {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function (event) {
            const data = JSON.parse(event.target.result);
            _problems = data;
        };
    } else { cocoMessage.warning("题库文件未成功读取！"); saveSuccess = false; }
    const file2 = document.querySelector("#map1-input").files[0];
    if (file2) {
        const reader2 = new FileReader();
        reader2.readAsText(file2);
        reader2.onload = function (event) {
            const data = JSON.parse(event.target.result);
            _map1 = data;
        };
    } else { cocoMessage.warning("舰队布局 1 未成功读取！"); saveSuccess = false; }
    const file3 = document.querySelector("#map2-input").files[0];
    if (file3) {
        const reader3 = new FileReader();
        reader3.readAsText(file3);
        reader3.onload = function (event) {
            const data = JSON.parse(event.target.result);
            _map2 = data;
        };
    } else { cocoMessage.warning("舰队布局 2 未成功读取！"); saveSuccess = false; }
    if (saveSuccess) {
        cocoMessage.success("配置成功！");
    }
    closeSettings();
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
    }, 5000);
    setTimeout(() => {
        document.querySelector("body").oncontextmenu = e => {
            e.preventDefault();
            document.querySelector('.quiz-area').style.transform = `translateY(${!isQuizAreaVisible ? 0 : "-100%"})`;
            isQuizAreaVisible ^= 1;
        }
    }, 6000)
}

function init() {
    const statusBar = document.querySelector('.status-bar');
    const gameBoard = document.querySelector('.game-board');
    statusBar.style.width = `${gameBoard.clientWidth}px`;
    cocoMessage.config({ duration: 1000 })
    document.oncontextmenu = (e) => e.preventDefault();
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
var funTransitionHeight = function (element) {
    if (typeof window.getComputedStyle == "undefined") return;
    let height = window.getComputedStyle(element).height;

    element.style.height = "auto";
    let targetHeight = window.getComputedStyle(element).height;
    element.style.height = height;
    element.offsetWidth = element.offsetWidth;
    element.style.height = targetHeight;
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

function Winner(name) {
    const options1 = {
        strings: [
            '胜&emsp;利&emsp;者&emsp;是'
        ],
        typeSpeed: 50,
        startDelay: 0,
        showCursor: false,
        loop: false
    };
    const options2 = {
        strings: [
            name
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
        schoolPride(84000);
        audioPool.playSound("resources/audio/Winner_Kun.mp3");
    }, 1000);
    setTimeout(() => {
        const typed1 = new Typed("#typed-1", options1);
        const typed2 = new Typed("#typed-2", options2);
    }, 2000);
}

generateLeftRightGrid();
generateMiddleGrid();