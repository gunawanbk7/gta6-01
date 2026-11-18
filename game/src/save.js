// save.js — localStorage persistence for cash, mission progress and position.
var SB = SB || {};
SB.save = (function () {
  var KEY = 'solmar-bay-save-v1';
  return {
    has: function () { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } },
    write: function (snap) {
      try { localStorage.setItem(KEY, JSON.stringify(snap)); return true; }
      catch (e) { return false; }
    },
    read: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (!raw) return null;
        var d = JSON.parse(raw);
        if (typeof d.cash !== 'number' || typeof d.missionIndex !== 'number') return null;
        return d;
      } catch (e) { return null; }
    },
    clear: function () { try { localStorage.removeItem(KEY); } catch (e) {} }
  };
})();
