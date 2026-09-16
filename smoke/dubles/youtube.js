/**
 * Dublê da API oficial do YouTube (iframe_api), servido no lugar dela.
 *
 * Reproduz o comportamento que importa para a sala:
 *  - reprodução automática COM SOM é recusada pelo navegador;
 *  - reprodução MUDA é permitida;
 *  - depois de um gesto real do usuário, som passa a ser permitido.
 *
 * Tudo que a sala fez fica registrado em window.__espiao, para o teste
 * poder afirmar coisas como "não houve seek no gesto de desmutar".
 */
window.__espiao = { seeks: [], vars: null, plays: 0, estados: [], mutes: [] };
window.__permitirSomAutomatico = window.__permitirSomAutomatico || false;
window.__houveGesto = false;

document.addEventListener(
  "pointerdown",
  function (e) {
    if (e.isTrusted) window.__houveGesto = true;
  },
  true,
);

(function () {
  var UNSTARTED = -1, ENDED = 0, PLAYING = 1, PAUSED = 2, BUFFERING = 3, CUED = 5;

  function Player(el, o) {
    var self = this;
    window.__espiao.vars = o.playerVars;
    this._estado = UNSTARTED;
    this._mudo = false;
    this._base = Number(o.playerVars.start) || 0;
    this._t0 = null;
    this._eventos = o.events || {};

    var iframe = document.createElement("iframe");
    iframe.setAttribute("data-duble-youtube", o.videoId);
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    el.appendChild(iframe);

    setTimeout(function () {
      if (self._eventos.onReady) self._eventos.onReady();
    }, 30);

    window.__player = this;
  }

  Player.prototype._mudar = function (estado) {
    this._estado = estado;
    window.__espiao.estados.push(estado);
    if (this._eventos.onStateChange) this._eventos.onStateChange({ data: estado });
  };

  Player.prototype.playVideo = function () {
    window.__espiao.plays++;
    var permitido = this._mudo || window.__permitirSomAutomatico || window.__houveGesto;
    if (!permitido) return; // o navegador recusou: o estado simplesmente não muda
    if (this._t0 === null) this._t0 = Date.now();
    var self = this;
    setTimeout(function () { self._mudar(PLAYING); }, 40);
  };

  Player.prototype.pauseVideo = function () {
    this._base = this.getCurrentTime();
    this._t0 = null;
    this._mudar(PAUSED);
  };

  Player.prototype.seekTo = function (s) {
    window.__espiao.seeks.push({ segundo: s, em: Date.now() });
    this._base = s;
    this._t0 = this._estado === PLAYING ? Date.now() : null;
  };

  Player.prototype.getCurrentTime = function () {
    return this._base + (this._t0 ? (Date.now() - this._t0) / 1000 : 0);
  };

  Player.prototype.getPlayerState = function () { return this._estado; };
  Player.prototype.mute = function () { this._mudo = true; window.__espiao.mutes.push(true); };
  Player.prototype.unMute = function () { this._mudo = false; window.__espiao.mutes.push(false); };
  Player.prototype.isMuted = function () { return this._mudo; };
  Player.prototype.setVolume = function () {};
  Player.prototype.destroy = function () {};

  /** Só para o teste: simula o player ficando para trás do relógio. */
  Player.prototype.__atrasar = function (segundos) { this._base -= segundos; };

  window.YT = {
    Player: Player,
    PlayerState: { UNSTARTED: UNSTARTED, ENDED: ENDED, PLAYING: PLAYING, PAUSED: PAUSED, BUFFERING: BUFFERING, CUED: CUED },
  };

  if (window.onYouTubeIframeAPIReady) window.onYouTubeIframeAPIReady();
})();
