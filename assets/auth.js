/* 배포본 전용. 잠금은 gate.js 가 맡으므로 여기서는 통과만 시킵니다.
 * 비밀번호 해시와 관리자 모드는 공개본에 넣지 않습니다. */
window.EXAM_AUTH = (function () {
  var SK = 'ncs_key';
  return {
    signedIn: function () { return true; },
    guard: function () { return true; },
    signIn: async function () { return 'user'; },
    login: async function () { return false; },
    logout: function () { },
    role: function () { return 'student'; },
    isAdmin: function () { return false; },
    label: function () { return '일반(학생)'; },
    signOut: function () {
      try { sessionStorage.removeItem(SK); localStorage.removeItem(SK); } catch (e) { }
    },
    paintTop: function (up) {
      var box = document.getElementById('tUser');
      if (!box) return;
      box.style.display = '';
      var name = document.getElementById('tName');
      if (name) name.textContent = this.label();
      var out = document.getElementById('tOut');
      if (out && !out.onclick) {
        var self = this;
        out.onclick = function () { self.signOut(); location.href = (up || '') + 'index.html'; };
      }
    }
  };
})();
