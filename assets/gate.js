/* 공개본 잠금 해제 — 배포본에서만 씁니다.
 *
 * 페이지 본문은 AES-256-GCM 으로 암호화된 채로 배포됩니다.
 * 비밀번호에서 PBKDF2 로 키를 만들어 본문을 풀고, 그 키를
 *   sessionStorage (기본, 탭을 닫으면 사라짐)
 *   localStorage   (「이 브라우저에서 로그인 유지」를 켰을 때)
 * 에 담아 둡니다. 다음 페이지부터는 비밀번호를 다시 묻지 않습니다.
 * 로그아웃하면 두 곳에서 모두 지웁니다.
 *
 * 키가 틀리면 GCM 인증이 실패하므로 별도의 비밀번호 확인 절차가 필요 없습니다.
 */
(function () {
  'use strict';

  var SK = 'ncs_key';       // 저장해 두는 파생 키 (base64)
  var ITER = 200000;        // PBKDF2 반복 횟수 — 배포 스크립트와 같아야 합니다
  var td = new TextDecoder();

  var pl = JSON.parse(document.getElementById('pl').textContent);
  var box = document.getElementById('lock');
  var form = document.getElementById('lf');
  var pw = document.getElementById('lp');
  var keep = document.getElementById('lk');
  var msg = document.getElementById('lm');
  var busy = false;

  function b64d(s) {
    var b = atob(s), a = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
    return a;
  }
  function b64e(buf) {
    var a = new Uint8Array(buf), s = '';
    for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s);
  }

  function readKey() {
    try { return sessionStorage.getItem(SK) || localStorage.getItem(SK); } catch (e) { return null; }
  }
  function saveKey(k, stay) {
    try { (stay ? localStorage : sessionStorage).setItem(SK, k); } catch (e) { }
  }
  function dropKey() {
    try { sessionStorage.removeItem(SK); localStorage.removeItem(SK); } catch (e) { }
  }

  async function derive(p) {
    var base = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveBits']);
    return await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: b64d(pl.salt), iterations: ITER, hash: 'SHA-256' }, base, 256);
  }

  async function unlock(raw) {
    var k = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    var out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(pl.iv) }, k, b64d(pl.ct));
    return td.decode(out);
  }

  /* 푼 본문으로 문서를 갈아 끼웁니다.
   *
   * document.write 는 쓰지 않습니다. 파싱 중에 부르면 지우지 않고 덧붙고,
   * 문서가 크면 중간에 잘립니다. 둘 다 겪었습니다.
   * 그래서 DOMParser 로 읽어 노드를 옮기고, script 만 따로 다시 만들어 실행합니다.
   * innerHTML 로 넣은 script 는 실행되지 않기 때문입니다. */
  function runScript(old) {
    return new Promise(function (done) {
      var s = document.createElement('script');
      for (var i = 0; i < old.attributes.length; i++) {
        s.setAttribute(old.attributes[i].name, old.attributes[i].value);
      }
      if (old.src) {
        s.onload = s.onerror = function () { done(); };
        document.body.appendChild(s);
      } else {
        s.textContent = old.textContent;
        document.body.appendChild(s);
        done();
      }
    });
  }

  async function show(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var scripts = [];

    function move(from, to) {
      var kids = [].slice.call(from.childNodes);
      for (var i = 0; i < kids.length; i++) {
        if (kids[i].tagName === 'SCRIPT') { scripts.push(kids[i]); continue; }
        to.appendChild(document.importNode(kids[i], true));
      }
    }

    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.body.removeAttribute('class');
    document.body.removeAttribute('style');
    move(doc.head, document.head);
    move(doc.body, document.body);
    if (doc.title) document.title = doc.title;

    for (var i = 0; i < scripts.length; i++) await runScript(scripts[i]);   // 순서대로
  }

  function fail(t) { msg.textContent = t; msg.hidden = false; }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (busy) return;
    busy = true;
    msg.hidden = true;
    var btn = form.querySelector('button');
    var label = btn.textContent;
    btn.textContent = '여는 중…';
    btn.disabled = true;
    try {
      var raw = await derive(pw.value);
      var html = await unlock(raw);          // 틀리면 여기서 예외가 납니다
      saveKey(b64e(raw), keep.checked);
      pw.value = '';
      await show(html);
      return;
    } catch (err) {
      fail('비밀번호가 맞지 않습니다.');
    }
    btn.textContent = label;
    btn.disabled = false;
    busy = false;
  });

  (async function boot() {
    if (!window.crypto || !crypto.subtle) {
      box.hidden = false;
      fail('이 브라우저에서는 열 수 없습니다. https 주소로 접속해 주세요.');
      return;
    }
    var k = readKey();
    if (k) {
      try { await show(await unlock(b64d(k))); return; }   // 저장된 키로 바로 열립니다
      catch (e) { dropKey(); }                       // 키가 옛것이면 버리고 다시 묻습니다
    }
    box.hidden = false;
    pw.focus();
  })();
})();
