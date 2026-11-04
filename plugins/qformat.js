/*!
 * hzq 题库格式适配：兼容 3099 题库编辑器的新格式
 *
 * 旧格式：[{ id, content, A..D, ans }]（content 支持 $公式$ / !?图片?!）
 * 新格式：{ schema:'hzq-problem/1', questions:[{ stem, options:{A..D}, answer }] }
 *        stem/options 是 Markdown，图片是 resources/img/problems/... 或相对路径
 *
 * 新格式统一转换成 hzq 的运行时结构 { content, A..D, ans, _format, 预渲染结果 }，
 * scripts.js 的校验、随机、判分、缓存逻辑不需要改动。
 */
(function (global) {
    'use strict';

    var QF = {};
    QF.SCHEMA = 'hzq-problem/1';
    QF.OPTIONS = ['A', 'B', 'C', 'D'];

    function escapeHtml(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/`/g, '&#96;');
    }
    QF.escapeHtml = escapeHtml;

    function trim(value) { return String(value == null ? '' : value).trim(); }

    /* ---------- 公式保护（与编辑器同一套规则） ---------- */

    var MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\begin\{([^}]+)\}([\s\S]+?)\\end\{\3\}|\$((?:\\.|[^$\\])+)\$|\\\(([\s\S]+?)\\\)/g;
    var TOKEN_HEAD = '\u0002M';
    var TOKEN_TAIL = '\u0002';

    function protectMath(source) {
        var math = [];
        var text = String(source == null ? '' : source).replace(MATH_RE, function (match, d1, d2, env, body, i1, i2) {
            var parsed;
            if (d1 != null) { parsed = { tex: d1, display: true }; }
            else if (d2 != null) { parsed = { tex: d2, display: true }; }
            else if (env != null) { parsed = { tex: '\\begin{' + env + '}' + body + '\\end{' + env + '}', display: true }; }
            else if (i1 != null) { parsed = { tex: i1, display: false }; }
            else { parsed = { tex: i2, display: false }; }
            var token = TOKEN_HEAD + math.length + TOKEN_TAIL;
            math.push({ token: token, tex: parsed.tex, display: parsed.display });
            return token;
        });
        return { text: text, math: math };
    }

    function renderMath(tex, display) {
        if (typeof katex === 'undefined') {
            return '<span class="latex-error">' + escapeHtml(tex) + '</span>';
        }
        try {
            return katex.renderToString(tex, {
                displayMode: !!display, throwOnError: false,
                strict: 'ignore', trust: false, output: 'html'
            });
        } catch (e) {
            return '<span class="latex-error">' + escapeHtml(tex) + '</span>';
        }
    }

    function substituteMath(html, math) {
        var out = String(html == null ? '' : html);
        (math || []).forEach(function (item) {
            out = out.split(item.token).join(renderMath(item.tex, item.display));
        });
        return out;
    }

    /* ---------- 消毒 ---------- */

    var ALLOWED_URI = /^(?:(?:blob|data|https?):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

    function sanitize(html) {
        if (typeof DOMPurify === 'undefined') { return escapeHtml(html); }
        return DOMPurify.sanitize(html, {
            ALLOWED_URI_REGEXP: ALLOWED_URI,
            FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button',
                'textarea', 'select', 'option', 'link', 'meta', 'base', 'svg', 'math', 'foreignObject'],
            FORBID_ATTR: ['style', 'srcset', 'formaction', 'xlink:href'],
            ADD_ATTR: ['target', 'rel']
        });
    }

    /* ---------- zip 里的图片 → blob URL ---------- */

    var assets = Object.create(null);
    var assetUrls = [];

    function releaseAssets() {
        assetUrls.forEach(function (url) { try { URL.revokeObjectURL(url); } catch (e) { } });
        assetUrls = [];
        assets = Object.create(null);
    }
    QF.releaseAssets = releaseAssets;

    var MIME = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
        webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml', avif: 'image/avif'
    };

    function resolveAssets(html) {
        return String(html).replace(/<img\b[^>]*>/gi, function (tag) {
            return tag.replace(/\bsrc\s*=\s*"([^"]*)"/i, function (whole, src) {
                var key = src.replace(/^\.\//, '');
                var url = assets[key] || assets[key.split('/').pop()];
                return url ? 'src="' + escapeHtml(url) + '"' : whole;
            });
        });
    }

    function renderMarkdown(source) {
        var protectedMath = protectMath(source);
        var raw;
        if (typeof marked !== 'undefined' && marked.parse) {
            raw = marked.parse(protectedMath.text, { gfm: true, breaks: true });
        } else {
            raw = '<p>' + escapeHtml(protectedMath.text).replace(/\n/g, '<br>') + '</p>';
        }
        return resolveAssets(substituteMath(sanitize(raw), protectedMath.math));
    }
    QF.renderMarkdown = renderMarkdown;

    function legacyParts(content, images) {
        if (typeof formatQuestionParts === 'function') {
            return formatQuestionParts(content, !!images);
        }
        return { html: escapeHtml(content), images: '' };
    }

    function ensureRendered(question) {
        if (!question || question._rendered) { return question; }
        if (question._format === 'legacy') {
            var stem = legacyParts(question.content, true);
            question._html = stem.html;
            question._images = stem.images;
            question._optionHtml = {};
            QF.OPTIONS.forEach(function (k) {
                question._optionHtml[k] = legacyParts(question[k], false).html;
            });
        } else {
            question._html = renderMarkdown(question.content);
            question._optionHtml = {};
            QF.OPTIONS.forEach(function (k) {
                question._optionHtml[k] = renderMarkdown(question[k]);
            });
            question._images = '';
        }
        question._rendered = true;
        return question;
    }
    QF.ensureRendered = ensureRendered;

    /* ---------- 规范化 ---------- */

    function stripPrefix(key, value) {
        return String(value == null ? '' : value).replace(new RegExp('^\\s*' + key + '\\s*[.．、:：)]\\s*'), '');
    }

    function build(format, stem, options, answer, notes, index) {
        return {
            content: stem,
            A: options.A, B: options.B, C: options.C, D: options.D,
            ans: answer,
            stem: stem, options: options, answer: answer,
            notes: notes || '',
            _format: format, _index: index
        };
    }

    QF.normalize = function (data) {
        var format = 'legacy';
        var list = data;
        if (!Array.isArray(data)) {
            if (!data || typeof data !== 'object' || !Array.isArray(data.questions)) {
                throw new Error('不是可识别的题库：应为数组或 { questions: [...] }');
            }
            format = 'hzq-problem';
            list = data.questions;
        }
        var questions = [];
        var errors = [];
        list.forEach(function (raw, i) {
            var label = '第 ' + (i + 1) + ' 题';
            var stem, options = {}, answer, notes = '';
            if (format === 'legacy') {
                stem = trim(raw && (raw.content || raw.stem));
                QF.OPTIONS.forEach(function (k) { options[k] = String(raw && raw[k] != null ? raw[k] : ''); });
                answer = trim(raw && (raw.ans || raw.answer)).toUpperCase();
            } else {
                stem = trim(raw && (raw.stem != null ? raw.stem : raw.content));
                var src = (raw && raw.options && typeof raw.options === 'object') ? raw.options : (raw || {});
                QF.OPTIONS.forEach(function (k) { options[k] = stripPrefix(k, src[k]); });
                answer = trim(raw && (raw.answer != null ? raw.answer : raw.ans)).toUpperCase();
                notes = trim(raw && raw.notes);
            }
            if (!stem) { errors.push(label + '：题干为空'); }
            QF.OPTIONS.forEach(function (k) {
                if (!trim(options[k])) { errors.push(label + '：选项 ' + k + ' 为空'); }
            });
            if (QF.OPTIONS.indexOf(answer) < 0) {
                errors.push(label + '：答案必须是 A/B/C/D（当前：' + (answer || '空') + '）');
            }
            if (stem && QF.OPTIONS.every(function (k) { return !!trim(options[k]); }) && QF.OPTIONS.indexOf(answer) >= 0) {
                questions.push(build(format, stem, options, answer, notes, i));
            }
        });
        if (errors.length) {
            throw new Error(errors.slice(0, 3).join('；') + (errors.length > 3 ? ' 等 ' + errors.length + ' 处问题' : ''));
        }
        if (!questions.length) { throw new Error('题库里没有可用题目'); }
        return { format: format, questions: questions, count: questions.length };
    };

    QF.readPack = function (bytes) {
        if (typeof fflate === 'undefined' || !fflate.unzipSync) {
            throw new Error('缺少 fflate，无法读取 zip');
        }
        var files = fflate.unzipSync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
        var names = Object.keys(files).filter(function (n) { return !/\/$/.test(n); });
        releaseAssets();
        names.forEach(function (name) {
            if (!/^resources\//i.test(name)) { return; }
            var url = URL.createObjectURL(new Blob([files[name]], {
                type: MIME[name.split('.').pop().toLowerCase()] || 'application/octet-stream'
            }));
            assetUrls.push(url);
            assets[name] = url;
            assets[name.split('/').pop()] = url;
        });
        var entry = names.filter(function (n) { return /^problems\.json$/i.test(n); })[0] ||
            names.filter(function (n) { return /(^|\/)problems\.json$/i.test(n); })[0] ||
            names.filter(function (n) { return /(^|\/)problems\.legacy\.json$/i.test(n); })[0];
        if (!entry) { throw new Error('zip 里没有 problems.json 或 problems.legacy.json'); }
        var result = QF.normalize(JSON.parse(fflate.strFromU8(files[entry])));
        result.source = entry;
        return result;
    };

    QF.decodeText = function (buffer) {
        var bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        var offset = 0, encoding = null;
        if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) { encoding = 'utf-8'; offset = 3; }
        else if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) { encoding = 'utf-16le'; offset = 2; }
        else if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) { encoding = 'utf-16be'; offset = 2; }
        function attempt(enc, fatal) {
            try { return new TextDecoder(enc, { fatal: !!fatal }).decode(bytes.subarray(offset)); } catch (e) { return null; }
        }
        if (encoding) { return attempt(encoding, true) || attempt(encoding, false) || ''; }
        var utf8 = attempt('utf-8', true);
        if (utf8 != null) { return utf8; }
        var gb = attempt('gb18030', true);
        if (gb != null) { return gb; }
        var a = attempt('utf-8', false) || '';
        var b = attempt('gb18030', false) || '';
        function bad(t) { return (t.match(/\uFFFD/g) || []).length; }
        return b && bad(b) < bad(a) ? b : a;
    };

    QF.looksLikeZip = function (bytes) {
        var b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        return b.length > 4 && b[0] === 0x50 && b[1] === 0x4B;
    };

    global.QFormat = QF;
})(window);
