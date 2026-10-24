
/* SONORA - Music Player
   Built with vanilla JavaScript
*/

(() => {
  "use strict";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const audio = $("#audio");
  const main = $("#main");
  const player = $("#player");
  const nav = $("#nav");
  const tabs = $("#tabs");
  const panel = $("#panel");
  const pls = $("#pls");
  const dialog = $("#dlg");
  const fileInput = $("#file");
  const toasts = $("#toasts");

  if (!audio || !main || !player) {
    console.error("SONORA: elemen utama tidak ditemukan.");
    return;
  }

  const state = {
    tracks: [],
    current: -1,
    favorites: new Set(),
    playlists: [],
    queue: [],
    view: "home",
    query: "",
    repeat: false,
    shuffle: false,
    volume: 0.8,
    toastTimer: null
  };

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const icon = (name, size = 20) => {
    const paths = {
      play: '<path d="m7 4 13 8-13 8z"/>',
      pause: '<path d="M8 5h3v14H8zM15 5h3v14h-3z"/>',
      next: '<path d="m5 4 11 8-11 8zM19 5v14"/>',
      prev: '<path d="m19 4-11 8 11 8zM5 5v14"/>',
      heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      upload: '<path d="M12 16V4m-5 5 5-5 5 5"/><path d="M4 16v4h16v-4"/>',
      volume: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15 9a5 5 0 0 1 0 6M18 6a9 9 0 0 1 0 12"/>',
      shuffle: '<path d="m18 14 4 4-4 4M18 2l4 4-4 4"/><path d="M2 18h2a5 5 0 0 0 4-2l8-10a5 5 0 0 1 4-2h2M2 6h2a5 5 0 0 1 4 2l1 1M14 15l2 3a5 5 0 0 0 4 2h2"/>',
      repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
      queue: '<path d="M4 6h16M4 12h16M4 18h10"/>',
      music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
      home: '<path d="m3 10 9-7 9 7v10h-6v-6H9v6H3z"/>',
      close: '<path d="m18 6-12 12M6 6l12 12"/>'
    };

    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">${paths[name] || paths.music}</svg>`;
  };

  function toast(message) {
    if (!toasts) return;
    toasts.textContent = message;
    toasts.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      toasts.classList.remove("show");
    }, 2400);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  function currentTrack() {
    return state.tracks[state.current] || null;
  }

  function isFavorite(track) {
    return state.favorites.has(track.id);
  }

  function trackCard(track, index) {
    return `
      <article class="track-card" data-track="${index}">
        <button class="track-cover" data-action="play-track"
          data-index="${index}" aria-label="Play ${escapeHTML(track.title)}">
          ${track.cover
            ? `<img src="${escapeHTML(track.cover)}" alt="">`
            : `<span>${icon("music", 34)}</span>`}
          <span class="cover-play">${icon("play", 22)}</span>
        </button>
        <div class="track-card-info">
          <button class="track-title" data-action="play-track"
            data-index="${index}">${escapeHTML(track.title)}</button>
          <p>${escapeHTML(track.artist)}</p>
        </div>
      </article>`;
  }

  function trackRow(track, index) {
    return `
      <div class="track-row ${index === state.current ? "is-playing" : ""}"
        data-track="${index}">
        <button class="track-row-play" data-action="play-track"
          data-index="${index}" aria-label="Play">
          ${index === state.current && !audio.paused
            ? icon("pause", 18) : icon("play", 18)}
        </button>
        <div class="track-row-cover">
          ${track.cover
            ? `<img src="${escapeHTML(track.cover)}" alt="">`
            : icon("music", 20)}
        </div>
        <button class="track-row-info" data-action="play-track"
          data-index="${index}">
          <strong>${escapeHTML(track.title)}</strong>
          <span>${escapeHTML(track.artist)}</span>
        </button>
        <span class="track-row-duration">${formatTime(track.duration)}</span>
        <button class="ib" data-action="favorite" data-index="${index}"
          aria-label="Favorite">
          ${icon("heart", 18)}
        </button>
        <button class="ib" data-action="queue-add" data-index="${index}"
          aria-label="Add to queue">${icon("plus", 18)}</button>
      </div>`;
  }

  function section(title, tracks, description = "") {
    if (!tracks.length) {
      return `<section class="music-section">
        <h2>${escapeHTML(title)}</h2>
        <p class="empty-message">Belum ada lagu. Impor file audio untuk memulai.</p>
      </section>`;
    }

    return `<section class="music-section">
      <div class="section-heading">
        <div><h2>${escapeHTML(title)}</h2>
        ${description ? `<p>${escapeHTML(description)}</p>` : ""}</div>
      </div>
      <div class="track-grid">${tracks.map(track =>
        trackCard(track, state.tracks.indexOf(track))).join("")}</div>
    </section>`;
  }

  function renderNavigation() {
    const items = [
      ["home", "Home", "home"],
      ["search", "Search", "search"],
      ["library", "Your Library", "music"],
      ["favorites", "Liked Songs", "heart"]
    ];

    const markup = items.map(([id, label, glyph]) => `
      <button class="nav-item ${state.view === id ? "active" : ""}"
        data-action="navigate" data-view="${id}">
        ${icon(glyph, 19)}<span>${label}</span>
      </button>`).join("");

    if (nav) nav.innerHTML = markup;
    if (tabs) tabs.innerHTML = markup;
  }

  function renderPlaylists() {
    if (!pls) return;
    pls.innerHTML = state.playlists.map((playlist, i) => `
      <button class="nav-item" data-action="playlist"
        data-index="${i}">${icon("music", 18)}
        <span>${escapeHTML(playlist.name)}</span>
      </button>`).join("");
  }

  function renderHome() {
    const recent = [...state.tracks].slice(-6).reverse();

    main.innerHTML = `
      <div class="page-content">
        <header class="page-header">
          <div><p class="eyebrow">YOUR MUSIC, YOUR WORLD</p>
          <h1>Good music.<br><span>Good mood.</span></h1>
          <p class="page-subtitle">Semua musik favoritmu, di satu tempat.</p></div>
          <button class="btn-primary" data-action="import">
            ${icon("upload", 18)} Import Music
          </button>
        </header>
        <section class="quick-actions">
          <button class="quick-card" data-action="navigate" data-view="favorites">
            ${icon("heart", 25)}<span>Liked Songs</span>
          </button>
          <button class="quick-card" data-action="import">
            ${icon("plus", 25)}<span>Add Music</span>
          </button>
        </section>
        ${section("Recently Added", recent)}
        <section class="music-section">
          <h2>Your Library</h2>
          ${state.tracks.length
            ? `<div class="track-list">${state.tracks.map(track =>
              trackRow(track, state.tracks.indexOf(track))).join("")}</div>`
            : `<div class="empty-state">
                <div class="empty-icon">${icon("music", 36)}</div>
                <h3>Your music starts here</h3>
                <p>Import audio files from your device to start listening.</p>
                <button class="btn-primary" data-action="import">
                  ${icon("upload", 18)} Choose audio files
                </button>
              </div>`}
        </section>
      </div>`;
  }

  function renderSearch() {
    const query = state.query.trim().toLowerCase();
    const results = state.tracks.filter(track =>
      `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(query));

    main.innerHTML = `
      <div class="page-content">
        <header class="page-header"><div>
          <p class="eyebrow">DISCOVER</p><h1>Search music</h1>
        </div></header>
        <label class="search-box">
          ${icon("search", 21)}
          <input id="search-input" type="search"
            placeholder="Songs, artists, albums..."
            value="${escapeHTML(state.query)}">
        </label>
        <section class="music-section">
          <h2>${query ? "Search Results" : "All Songs"}</h2>
          ${results.length
            ? `<div class="track-list">${results.map(track =>
              trackRow(track, state.tracks.indexOf(track))).join("")}</div>`
            : `<p class="empty-message">${query
              ? "No matching songs found."
              : "Import audio files to see them here."}</p>`}
        </section>
      </div>`;

    const input = $("#search-input");
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }

  function renderLibrary() {
    main.innerHTML = `
      <div class="page-content">
        <header class="page-header"><div>
          <p class="eyebrow">YOUR COLLECTION</p><h1>Your Library</h1>
        </div>
        <button class="btn-primary" data-action="import">
          ${icon("upload", 18)} Import Music
        </button></header>
        <div class="track-list">${state.tracks.map(track =>
          trackRow(track, state.tracks.indexOf(track))).join("")}</div>
        ${!state.tracks.length
          ? `<p class="empty-message">Your library is empty. Import music to begin.</p>` : ""}
      </div>`;
  }

  function renderFavorites() {
    const tracks = state.tracks.filter(isFavorite);
    main.innerHTML = `
      <div class="page-content">
        <header class="page-header"><div>
          <p class="eyebrow">YOUR COLLECTION</p><h1>Liked Songs ♥</h1>
          <p class="page-subtitle">${tracks.length} liked songs</p>
        </div></header>
        ${tracks.length
          ? `<div class="track-list">${tracks.map(track =>
            trackRow(track, state.tracks.indexOf(track))).join("")}</div>`
          : `<p class="empty-message">Lagu favoritmu akan muncul di sini.</p>`}
      </div>`;
  }

  function renderPlaylist(index) {
    const playlist = state.playlists[index];
    if (!playlist) return renderHome();

    const tracks = playlist.ids.map(id =>
      state.tracks.find(track => track.id === id)).filter(Boolean);

    main.innerHTML = `
      <div class="page-content">
        <header class="page-header"><div>
          <p class="eyebrow">PLAYLIST</p><h1>${escapeHTML(playlist.name)}</h1>
          <p class="page-subtitle">${tracks.length} songs</p>
        </div></header>
        ${tracks.length
          ? `<div class="track-list">${tracks.map(track =>
            trackRow(track, state.tracks.indexOf(track))).join("")}</div>`
          : `<p class="empty-message">Playlist ini masih kosong.</p>`}
      </div>`;
  }

  function renderMain() {
    renderNavigation();
    renderPlaylists();

    if (state.view === "search") return renderSearch();
    if (state.view === "library") return renderLibrary();
    if (state.view === "favorites") return renderFavorites();
    if (state.view.startsWith("playlist-")) {
      return renderPlaylist(Number(state.view.split("-")[1]));
    }
    renderHome();
  }

  function renderPlayer() {
    const track = currentTrack();

    player.innerHTML = `
      <div class="player-track">
        <div class="player-cover">
          ${track?.cover
            ? `<img src="${escapeHTML(track.cover)}" alt="">`
            : icon("music", 22)}
        </div>
        <div class="player-track-info">
          <strong>${escapeHTML(track?.title || "No song selected")}</strong>
          <span>${escapeHTML(track?.artist || "Import music to begin")}</span>
        </div>
        <button class="ib ${track && isFavorite(track) ? "liked" : ""}"
          data-action="favorite-current" aria-label="Like song">
          ${icon("heart", 19)}
        </button>
      </div>
      <div class="player-controls">
        <div class="control-buttons">
          <button class="ib ${state.shuffle ? "active" : ""}"
            data-action="shuffle" aria-label="Shuffle">${icon("shuffle", 18)}</button>
          <button class="ib" data-action="previous" aria-label="Previous">
            ${icon("prev", 20)}</button>
          <button class="play-main" data-action="toggle-play"
            aria-label="${audio.paused ? "Play" : "Pause"}">
            ${icon(audio.paused ? "play" : "pause", 21)}</button>
          <button class="ib" data-action="next" aria-label="Next">
            ${icon("next", 20)}</button>
          <button class="ib ${state.repeat ? "active" : ""}"
            data-action="repeat" aria-label="Repeat">${icon("repeat", 18)}</button>
        </div>
        <div class="progress-row">
          <span id="elapsed">${formatTime(audio.currentTime)}</span>
          <input id="progress" type="range" min="0" max="1000"
            value="${audio.duration ? Math.round(audio.currentTime / audio.duration * 1000) : 0}"
            aria-label="Playback progress">
          <span id="duration">${formatTime(audio.duration)}</span>
        </div>
      </div>
      <div class="player-extra">
        <button class="ib" data-action="show-queue" aria-label="Queue">
          ${icon("queue", 19)}</button>
        ${icon("volume", 19)}
        <input id="volume" type="range" min="0" max="1" step="0.01"
          value="${state.volume}" aria-label="Volume">
      </div>`;

    audio.volume = state.volume;
  }

  function renderQueue() {
    if (!panel) return;
    panel.innerHTML = `
      <div class="panel-heading"><h2>Up Next</h2>
        <button class="ib" data-action="close-queue" aria-label="Close">
          ${icon("close", 18)}</button>
      </div>
      ${state.queue.length
        ? `<div class="queue-list">${state.queue.map((index, position) => {
            const track = state.tracks[index];
            if (!track) return "";
            return `<div class="queue-item">
              <button data-action="play-track" data-index="${index}">
                ${escapeHTML(track.title)}<small>${escapeHTML(track.artist)}</small>
              </button>
              <button class="ib" data-action="queue-remove"
                data-position="${position}">${icon("close", 16)}</button>
            </div>`;
          }).join("")}</div>`
        : `<p class="empty-message">Your queue is empty.</p>`}`;
    panel.classList.add("open");
  }

  function renderAll() {
    renderMain();
    renderPlayer();
  }

  function playTrack(index) {
    const track = state.tracks[index];
    if (!track) return;

    state.current = index;
    audio.src = track.url;
    audio.load();
    audio.play().then(() => {
      renderAll();
    }).catch(() => {
      renderAll();
      toast("Tap play to start this track.");
    });
    renderAll();
  }

  function togglePlay() {
    if (!currentTrack()) {
      if (state.tracks.length) playTrack(0);
      else {
        toast("Import some music first.");
        fileInput?.click();
      }
      return;
    }

    if (audio.paused) {
      audio.play().catch(() => toast("Could not play this file."));
    } else {
      audio.pause();
    }
    renderPlayer();
  }

  function nextTrack() {
    if (!state.tracks.length) return;

    if (state.queue.length) {
      const next = state.queue.shift();
      playTrack(next);
      return;
    }

    let next = state.current + 1;
    if (state.shuffle && state.tracks.length > 1) {
      do {
        next = Math.floor(Math.random() * state.tracks.length);
      } while (next === state.current);
    } else if (next >= state.tracks.length) {
      if (!state.repeat) {
        audio.pause();
        audio.currentTime = 0;
        renderPlayer();
        return;
      }
      next = 0;
    }

    playTrack(next);
  }

  function previousTrack() {
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    if (!state.tracks.length) return;
    playTrack((state.current - 1 + state.tracks.length) % state.tracks.length);
  }

  function addFiles(files) {
    const audioFiles = [...files].filter(file =>
      file.type.startsWith("audio/"));

    if (!audioFiles.length) {
      toast("No audio files selected.");
      return;
    }

    for (const file of audioFiles) {
      const id = `${file.name}-${file.size}-${file.lastModified}`;
      if (state.tracks.some(track => track.id === id)) continue;

      state.tracks.push({
        id,
        title: file.name.replace(/\.[^.]+$/, ""),
        artist: "Local File",
        album: "Your Library",
        duration: 0,
        url: URL.createObjectURL(file),
        cover: "",
        file
      });
    }

    audioFiles.forEach(file => {
      const track = state.tracks.find(item => item.file === file);
      if (!track) return;

      const probe = new Audio();
      probe.preload = "metadata";
      probe.src = track.url;
      probe.addEventListener("loadedmetadata", () => {
        track.duration = probe.duration || 0;
        if (currentTrack()?.id === track.id) renderPlayer();
        if (state.view === "home") renderHome();
      }, { once: true });
    });

    renderAll();
    toast(`${audioFiles.length} audio file(s) added.`);
  }

  function toggleFavorite(index) {
    const track = state.tracks[index];
    if (!track) return;

    if (state.favorites.has(track.id)) {
      state.favorites.delete(track.id);
      toast("Removed from Liked Songs.");
    } else {
      state.favorites.add(track.id);
      toast("Added to Liked Songs ♥");
    }

    renderAll();
  }

  function createPlaylist() {
    if (!dialog) {
      const name = prompt("Playlist name:");
      if (name?.trim()) {
        state.playlists.push({
          name: name.trim(),
          ids: []
        });
        renderAll();
      }
      return;
    }

    dialog.innerHTML = `
      <form method="dialog" class="dialog-content" id="playlist-form">
        <h2>Create playlist</h2>
        <input name="playlistName" maxlength="60" required
          placeholder="My playlist" aria-label="Playlist name">
        <div class="dialog-actions">
          <button type="button" class="btn-secondary"
            data-action="close-dialog">Cancel</button>
          <button type="submit" class="btn-primary">Create</button>
        </div>
      </form>`;

    if (!dialog.open) dialog.showModal();
  }

  function navigate(view) {
    state.view = view;
    renderMain();
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const index = Number(button.dataset.index);

    switch (action) {
      case "navigate":
        navigate(button.dataset.view);
        break;
      case "play-track":
        if (index === state.current && !audio.paused) {
          audio.pause();
        } else {
          playTrack(index);
        }
        renderPlayer();
        break;
      case "toggle-play":
        togglePlay();
        break;
      case "next":
        nextTrack();
        break;
      case "previous":
        previousTrack();
        break;
      case "shuffle":
        state.shuffle = !state.shuffle;
        renderPlayer();
        toast(state.shuffle ? "Shuffle on" : "Shuffle off");
        break;
      case "repeat":
        state.repeat = !state.repeat;
        renderPlayer();
        toast(state.repeat ? "Repeat on" : "Repeat off");
        break;
      case "favorite":
        toggleFavorite(index);
        break;
      case "favorite-current":
        if (state.current >= 0) toggleFavorite(state.current);
        break;
      case "import":
        fileInput?.click();
        break;
      case "newpl":
        createPlaylist();
        break;
      case "playlist":
        state.view = `playlist-${index}`;
        renderMain();
        break;
      case "queue-add":
        if (state.tracks[index]) {
          state.queue.push(index);
          toast("Added to queue.");
          if (panel?.classList.contains("open")) renderQueue();
        }
        break;
      case "queue-remove":
        state.queue.splice(Number(button.dataset.position), 1);
        renderQueue();
        break;
      case "show-queue":
        renderQueue();
        break;
      case "close-queue":
        panel?.classList.remove("open");
        break;
      case "close-dialog":
        dialog?.close();
        break;
    }
  });

  document.addEventListener("input", event => {
    if (event.target.id === "search-input") {
      const position = event.target.selectionStart;
      state.query = event.target.value;
      renderSearch();
      const input = $("#search-input");
      input?.focus();
      if (position !== null) input?.setSelectionRange(position, position);
    }

    if (event.target.id === "progress" && audio.duration) {
      audio.currentTime = Number(event.target.value) / 1000 * audio.duration;
    }

    if (event.target.id === "volume") {
      state.volume = Number(event.target.value);
      audio.volume = state.volume;
    }
  });

  fileInput?.addEventListener("change", event => {
    addFiles(event.target.files || []);
    event.target.value = "";
  });

  dialog?.addEventListener("submit", event => {
    if (event.target.id !== "playlist-form") return;
    event.preventDefault();

    const name = new FormData(event.target).get("playlistName")?.toString().trim();
    if (!name) return;

    state.playlists.push({ name, ids: [] });
    dialog.close();
    renderAll();
    toast("Playlist created.");
  });

  audio.addEventListener("timeupdate", () => {
    const progress = $("#progress");
    const elapsed = $("#elapsed");

    if (progress && audio.duration) {
      progress.value = Math.round(audio.currentTime / audio.duration * 1000);
    }
    if (elapsed) elapsed.textContent = formatTime(audio.currentTime);
  });

  audio.addEventListener("loadedmetadata", () => {
    const duration = $("#duration");
    if (duration) duration.textContent = formatTime(audio.duration);
  });

  audio.addEventListener("play", () => renderPlayer());
  audio.addEventListener("pause", () => renderPlayer());
  audio.addEventListener("ended", () => {
    if (state.repeat) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } else {
      nextTrack();
    }
  });

  audio.addEventListener("error", () => {
    if (currentTrack()) toast("This audio file could not be played.");
  });

  renderAll();
})();
