<template>
  <Transition name="player-drop">
    <!-- 壁纸展示模式下隐藏（走同样的上滑淡出动画） -->
    <div
      v-if="store.musicOpenState && !store.backgroundShow"
      ref="playerEl"
      class="player"
    >
      <!-- 椭圆长条播放器：滚轮调节音量 -->
      <div class="bar" @wheel.prevent="onBarWheel">
        <!-- 圆形专辑封面 + 环形频谱 -->
        <div class="cover-wrap">
          <div class="cover">
            <img
              v-if="currentSong?.cover"
              :key="currentIndex"
              :class="{ spinning: isPlaying }"
              :src="currentSong.cover"
              alt="cover"
            />
            <MusicOne v-else theme="outline" size="20" fill="#ffffffcc" />
          </div>
          <canvas ref="spectrumEl" class="spectrum" width="128" height="128" />
        </div>

        <!-- 歌曲信息：第一行 歌名 - 作者，第二行 歌词 -->
        <div class="info">
          <div class="name text-hidden">{{ titleLine }}</div>
          <div class="lyric">
            <!-- 卡拉OK：底色文字 + 随进度增长的亮色文字 -->
            <span v-if="currentLyric" class="karaoke">
              <span class="karaoke-base">{{ currentLyric.text }}</span>
              <span class="karaoke-fill" :style="{ width: `${lyricProgress}%` }">
                <span class="karaoke-text">{{ currentLyric.text }}</span>
              </span>
            </span>
            <span v-else class="lyric-tip">{{ lyricTip }}</span>
          </div>
        </div>

        <!-- 播放控制 -->
        <div class="controls">
          <button class="btn" title="上一首" @click="prev">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M15 5 8 12l7 7"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          <button class="btn play" title="播放 / 暂停" @click="togglePlay">
            <svg v-if="isPlaying" class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="7" y="5" width="3.6" height="14" rx="1.4" fill="currentColor" />
              <rect x="13.4" y="5" width="3.6" height="14" rx="1.4" fill="currentColor" />
            </svg>
            <svg v-else class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M8 5.6v12.8a1 1 0 0 0 1.52.85l10.2-6.4a1 1 0 0 0 0-1.7L9.52 4.75A1 1 0 0 0 8 5.6Z"
                fill="currentColor"
              />
            </svg>
          </button>

          <button class="btn" title="下一首" @click="next">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 5l7 7-7 7"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          <span class="divider" aria-hidden="true" />

          <button
            class="btn list"
            :class="{ active: listOpen }"
            title="歌曲列表"
            @click="toggleList"
          >
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 7h16M4 12h16M4 17h10"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>

        <!-- 播放进度：点击或拖动跳转 -->
        <div
          ref="progressRef"
          class="progress"
          :class="{ dragging }"
          title="点击或拖动调整进度"
          @mousedown="startDrag"
          @touchstart.passive="startDrag"
        >
          <div class="progress-track">
            <div class="progress-played" :style="{ width: `${percent}%` }" />
          </div>
          <div class="progress-knob" :style="{ left: `${percent}%` }" />
        </div>
      </div>

      <!-- 音量调节框：滚轮操作后短暂出现 -->
      <Transition name="volume-fade">
        <div v-if="volumeOpen && !listOpen" class="volume">
          <div class="volume-head">
            <svg class="volume-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 9.5v5a1 1 0 0 0 1 1h2.6L12 19.5v-15L7.6 8.5H5a1 1 0 0 0-1 1Z"
                fill="currentColor"
              />
              <path
                d="M15.4 9.2a4 4 0 0 1 0 5.6"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
              />
            </svg>
            <span class="volume-value">{{ volumePercent }}%</span>
          </div>
          <div class="volume-track">
            <div class="volume-fill" :style="{ width: `${volumePercent}%` }" />
          </div>
        </div>
      </Transition>

      <!-- 歌曲列表：从中间向两侧展开 -->
      <Transition name="list-expand">
        <div
          v-if="listOpen"
          ref="listEl"
          class="song-list"
          :class="{ grabbing: draggingList }"
          @pointerdown="onListPointerDown"
          @wheel="onListWheel"
        >
          <!-- 内容层：越界时整体位移做橡皮筋回弹 -->
          <div
            class="song-track"
            :class="{ bouncing }"
            :style="{ '--over': `${overscroll}px` }"
          >
            <div
              v-for="(song, index) in songs"
              :key="index"
              class="song"
              :class="{ active: index === currentIndex }"
              :style="{ '--i': index }"
              @click="onSongClick(index)"
            >
              <span class="song-name text-hidden">{{ song.name }}</span>
              <span class="song-artist text-hidden">{{ song.artist }}</span>
            </div>
          </div>
        </div>
      </Transition>

      <audio
        ref="audioRef"
        preload="none"
        crossorigin="anonymous"
        @play="isPlaying = true"
        @pause="isPlaying = false"
        @ended="next"
        @error="onAudioError"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="syncDuration"
        @durationchange="syncDuration"
      />
    </div>
  </Transition>
</template>

<script setup>
import { MusicOne } from "@icon-park/vue-next";
import { getPlayerList } from "@/api";
import { mainStore } from "@/store";

const store = mainStore();

const playerEl = ref(null);
const audioRef = ref(null);
const songs = ref([]);
const currentIndex = ref(0);
const isPlaying = ref(false);
const loading = ref(false);
const listOpen = ref(false);
// 记录歌单是否已尝试加载，避免每次开关都重新请求
const loaded = ref(false);

const currentSong = computed(() => songs.value[currentIndex.value] || null);

// 第一行：歌名 - 作者合并显示
const titleLine = computed(() => {
  if (loading.value) return "歌单加载中…";
  const song = currentSong.value;
  if (!song) return "暂无歌曲";
  return song.artist ? `${song.name} - ${song.artist}` : song.name;
});

/* ---------------- 歌词 ---------------- */
const lyrics = ref([]); // [{ time: Number, text: String }]
const lyricOffset = 0.25; // 略微提前，让歌词与听感对齐

// 解析 LRC 文本，支持一行多个时间戳
const parseLrc = (raw) => {
  const result = [];
  const timeReg = /\[(\d{2}):(\d{2})(?:[.:](\d{2,3}))?\]/g;

  String(raw || "")
    .split(/\r?\n/)
    .forEach((line) => {
      const stamps = [...line.matchAll(timeReg)];
      if (!stamps.length) return;

      const text = line.replace(timeReg, "").trim();
      if (!text) return;

      stamps.forEach((stamp) => {
        const min = Number(stamp[1]);
        const sec = Number(stamp[2]);
        const fracRaw = stamp[3] || "0";
        const frac = Number(fracRaw) / (fracRaw.length === 2 ? 100 : 1000);
        result.push({ time: min * 60 + sec + frac, text });
      });
    });

  return result.sort((a, b) => a.time - b.time);
};

// 拉取歌词（Meting 的 lrc 字段本身就是一个文本接口）
const loadLyric = async (song) => {
  lyrics.value = [];
  if (!song?.lrc) return;
  try {
    const res = await fetch(song.lrc);
    lyrics.value = parseLrc(await res.text());
  } catch (error) {
    console.warn("歌词加载失败：", error);
  }
};

// 当前歌词行索引
const currentLyricIndex = computed(() => {
  const now = currentTime.value + lyricOffset;
  let index = -1;
  for (let i = 0; i < lyrics.value.length; i += 1) {
    if (lyrics.value[i].time <= now) index = i;
    else break;
  }
  return index;
});

const currentLyric = computed(() => lyrics.value[currentLyricIndex.value] || null);

// 没有歌词时的提示文案
const lyricTip = computed(() => {
  if (!songs.value.length) return "暂无可用歌曲";
  if (!lyrics.value.length) return "暂无歌词";
  return "";
});

// 卡拉OK进度：当前句到下一句之间线性推进，形成逐字填色效果
const lyricProgress = computed(() => {
  const index = currentLyricIndex.value;
  if (index < 0) return 0;

  const line = lyrics.value[index];
  const next = lyrics.value[index + 1];
  const start = line.time;
  // 最后一句没有下一句，按字数估算一个合理时长
  const end = next ? next.time : start + Math.max(3, line.text.length * 0.32);
  const span = Math.max(end - start, 0.3);

  const ratio = (currentTime.value + lyricOffset - start) / span;
  return Math.min(100, Math.max(0, ratio * 100));
});

// 加载歌单（音源由 .env 中的 VITE_SONG_* 决定）
const loadSongs = async () => {
  if (loaded.value || loading.value) return;
  loading.value = true;
  try {
    const list = await getPlayerList(
      import.meta.env.VITE_SONG_SERVER,
      import.meta.env.VITE_SONG_TYPE,
      import.meta.env.VITE_SONG_ID,
    );
    // 过滤掉没有播放地址的条目
    songs.value = (list || []).filter((item) => item?.url);
    loaded.value = true;
  } catch (error) {
    console.error("歌单加载失败：", error);
    ElMessage({
      message: "歌单加载失败，请检查音源配置",
      grouping: true,
    });
    // 允许下次打开时重试
    loaded.value = false;
  } finally {
    loading.value = false;
  }
};

// 播放指定歌曲
const playAt = async (index) => {
  if (!songs.value.length) {
    await loadSongs();
  }
  const song = songs.value[index];
  if (!song) return;

  currentIndex.value = index;
  // 切歌时重置进度，等新音频的元数据回来再更新时长
  currentTime.value = 0;
  duration.value = 0;
  // 歌词异步加载，不阻塞播放
  loadLyric(song);
  await nextTick();

  // 切歌后把当前项滚进可视范围
  scrollToActive();

  const audio = audioRef.value;
  if (!audio) return;

  initAnalyser();
  // AudioContext 必须在用户手势里恢复，否则一直处于 suspended
  audioCtx?.resume?.();

  audio.src = song.url;
  audio.volume = volume.value;
  // 换歌时重新取封面色
  extractCoverColor(song.cover);

  try {
    await audio.play();
  } catch (error) {
    console.warn("播放被中断：", error);
    isPlaying.value = false;
  }
};

// 播放 / 暂停
const togglePlay = () => {
  const audio = audioRef.value;
  if (!audio) return;

  // 尚未选择歌曲时，从第一首开始
  if (!audio.src) {
    playAt(currentIndex.value);
    return;
  }

  if (audio.paused) {
    audio.play().catch((error) => {
      console.warn("播放失败：", error);
      isPlaying.value = false;
    });
  } else {
    audio.pause();
  }
};

const next = () => {
  if (!songs.value.length) return;
  playAt((currentIndex.value + 1) % songs.value.length);
};

const prev = () => {
  if (!songs.value.length) return;
  playAt((currentIndex.value - 1 + songs.value.length) % songs.value.length);
};

const toggleList = () => {
  listOpen.value = !listOpen.value;
};

// 当前歌曲不在列表可视范围时，自动滚到中间
const scrollToActive = (smooth = true) => {
  if (!listOpen.value) return;

  const list = listEl.value;
  if (!list) return;

  const active = list.querySelector(".song.active");
  if (!active) return;

  const left = list.scrollLeft;
  const right = left + list.clientWidth;
  const itemLeft = active.offsetLeft;
  const itemRight = itemLeft + active.offsetWidth;

  // 已经在可视范围里就不打扰
  if (itemLeft >= left && itemRight <= right) return;

  list.scrollTo({
    left: itemLeft - (list.clientWidth - active.offsetWidth) / 2,
    behavior: smooth ? "smooth" : "auto",
  });
};

/* ---------------- 音量 ---------------- */
const volume = ref(0.8);
const volumeOpen = ref(false);
let volumeTimer = null;

const volumePercent = computed(() => Math.round(volume.value * 100));

const applyVolume = (next) => {
  // 以 1% 为步进，避免浮点误差累积出 58.99999%
  const value = Math.min(1, Math.max(0, Math.round(next * 100) / 100));
  volume.value = value;
  if (audioRef.value) audioRef.value.volume = value;
};

const showVolume = () => {
  volumeOpen.value = true;
  clearTimeout(volumeTimer);
  volumeTimer = setTimeout(() => {
    volumeOpen.value = false;
  }, 1600);
};

// 播放条上滚动滚轮：列表开着就收起列表，否则调节音量
const onBarWheel = (event) => {
  if (listOpen.value) {
    listOpen.value = false;
    return;
  }

  const step = event.deltaY < 0 ? 0.05 : -0.05;
  applyVolume(volume.value + step);
  showVolume();
};

// 歌曲列表展开时收起音量框，并把当前歌曲定位到可视范围
watch(listOpen, (open) => {
  if (!open) return;

  volumeOpen.value = false;
  // 展开动画期间直接定位，平滑滚动会被动画盖住
  nextTick(() => scrollToActive(false));
});

// 点击播放器以外的空白处收起列表
const handleOutsideClick = (event) => {
  if (!listOpen.value) return;
  // 刚拖拽完，这次 click 是拖动的副产物，不算点空白
  if (performance.now() < ignoreOutsideUntil) return;

  const el = playerEl.value;
  if (el && !el.contains(event.target)) {
    listOpen.value = false;
  }
};

// 桌面端：滚轮 / 触摸板滑动，转为列表横向滚动
const listEl = ref(null);

const onListWheel = (event) => {
  const el = listEl.value;
  if (!el || el.scrollWidth <= el.clientWidth) return;

  event.preventDefault();
  // 触摸板横向滑动时 deltaX 有值，取绝对值更大的那个方向
  const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
  el.scrollLeft += delta;
};

/* 桌面端：长按鼠标左键拖动列表，松手带惯性与边界回弹 */
const draggingList = ref(false);
const inertiaRunning = ref(false);
// 拖拽松手后的一小段时间内忽略「点空白关闭」，
// 否则甩出去再松手，浏览器补发的 click 会命中列表外的元素，被当成点空白
let ignoreOutsideUntil = 0;
// 越界位移（带阻尼），由内容层 transform 承载
const overscroll = ref(0);

// { startX, startLeft, moved }
let listDrag = null;
let inertiaId = null;
// 最近一次移动的速度（px/ms，scrollLeft 方向）
let lastMove = { x: 0, time: 0, velocity: 0 };

// 回弹最大位移
const MAX_OVERSCROLL = 72;

// 拖动 / 惯性期间不加过渡，否则每帧位移会被 transition 拖慢
const bouncing = computed(() => !draggingList.value && !inertiaRunning.value);

// 统一滚动入口：把越界量转成内容层位移，形成橡皮筋
const applyScroll = (desired) => {
  const el = listEl.value;
  if (!el) return;

  const max = Math.max(0, el.scrollWidth - el.clientWidth);
  let over = 0;

  if (desired < 0) {
    el.scrollLeft = 0;
    over = desired;
  } else if (desired > max) {
    el.scrollLeft = max;
    over = desired - max;
  } else {
    el.scrollLeft = desired;
  }

  // 阻尼：越拖越沉，并且封顶
  // 注意要取反：scrollLeft 减小代表内容右移，越界量是负数，
  // 而对内容层来说应该往右位移（跟手），所以位移方向与 over 相反
  overscroll.value = -Math.sign(over) * Math.min(MAX_OVERSCROLL, Math.abs(over) * 0.45);
};

const cancelInertia = () => {
  if (inertiaId !== null) cancelAnimationFrame(inertiaId);
  inertiaId = null;
  inertiaRunning.value = false;
};

// 回弹归位的 rAF 句柄（连续拖动时会被打断）
let releaseRafId = null;

const cancelPendingRelease = () => {
  if (releaseRafId !== null) cancelAnimationFrame(releaseRafId);
  releaseRafId = null;
};

// 松手 / 惯性结束后回弹归位
const releaseOverscroll = () => {
  draggingList.value = false;
  inertiaRunning.value = false;
  if (overscroll.value === 0) return;

  // 下一帧归零，确保过渡是从当前偏移开始
  cancelPendingRelease();
  releaseRafId = requestAnimationFrame(() => {
    releaseRafId = null;
    // 期间若又开始拖动或惯性，交给新状态处理，避免把位移清零
    if (draggingList.value || inertiaRunning.value) return;
    overscroll.value = 0;
  });
};

// 松手后按当前速度继续滑，并按帧衰减
const startInertia = (velocity) => {
  const el = listEl.value;
  if (!el) return;

  // 速度限幅，避免极快拖动甩飞
  let v = Math.max(-3, Math.min(3, velocity));
  if (Math.abs(v) < 0.05) {
    releaseOverscroll();
    return;
  }

  cancelInertia();
  inertiaRunning.value = true;

  let last = performance.now();
  // 虚拟位置允许越界，用它驱动回弹
  let virtual = el.scrollLeft;

  const step = (now) => {
    const dt = Math.min(now - last, 48);
    last = now;

    virtual += v * dt;
    // 每帧约衰减 6%，约 1 秒滑停
    v *= Math.pow(0.94, dt / 16.7);
    applyScroll(virtual);

    if (Math.abs(v) < 0.02) {
      inertiaId = null;
      releaseOverscroll();
      return;
    }
    inertiaId = requestAnimationFrame(step);
  };

  inertiaId = requestAnimationFrame(step);
};

const onListPointerDown = (event) => {
  // 鼠标只响应左键；触摸一并接管（配合 CSS 的 touch-action: none）
  if (event.pointerType === "mouse" && event.button !== 0) return;
  // 已经有一根手指在拖了，忽略后续触点
  if (listDrag) return;

  const el = listEl.value;
  if (!el || el.scrollWidth <= el.clientWidth) return;

  // 按住即停，和手机端一致
  cancelInertia();
  cancelPendingRelease();

  // 起点按「看到的画面」算：回弹没结束时内容有额外偏移，
  // 只记 scrollLeft 会让第一下拖动突然加速
  listDrag = {
    startX: event.clientX,
    startLeft: el.scrollLeft - overscroll.value,
    moved: false,
  };
  lastMove = { x: event.clientX, time: performance.now(), velocity: 0 };
};

const onListPointerMove = (event) => {
  if (!listDrag) return;

  const dx = event.clientX - listDrag.startX;

  // 超过阈值才算拖动：单击时不进拖动状态，否则会吃掉歌曲点击
  if (!listDrag.moved && Math.abs(dx) > 4) {
    listDrag.moved = true;
    draggingList.value = true;
  }
  if (!listDrag.moved) return;

  applyScroll(listDrag.startLeft - dx);

  // 采样速度用于松手后的惯性
  const now = performance.now();
  const dt = now - lastMove.time;
  if (dt > 0) {
    lastMove.velocity = -(event.clientX - lastMove.x) / dt;
    lastMove.x = event.clientX;
    lastMove.time = now;
  }
};

const onListPointerUp = () => {
  if (!listDrag) return;

  // 记住这一轮的引用：清理时要确认清的还是自己，
  // 否则连续快拖时，上一轮的延迟清理会把新一轮的状态清空，导致拖动失灵
  const current = listDrag;
  const moved = current.moved;
  draggingList.value = false;

  // 松手后留一段静默期，防止补发的 click 把列表关掉
  if (moved) ignoreOutsideUntil = performance.now() + 350;

  // 已经拖出边界时松手，直接回弹；
  // 若还走惯性，会把内容先往外再顶一段才弹回，看起来像抽了一下
  if (moved && overscroll.value === 0) {
    startInertia(lastMove.velocity);
  } else {
    releaseOverscroll();
  }

  // 延后清空，让紧跟着触发的 click 能读到 moved 标记
  setTimeout(() => {
    if (listDrag === current) listDrag = null;
  }, 0);
};

// 列表项点击：刚拖动过就不算点击
const onSongClick = (index) => {
  if (listDrag?.moved) return;
  playAt(index);
};

/* ---------------- 播放进度 ---------------- */
const progressRef = ref(null);
const currentTime = ref(0);
const duration = ref(0);
const dragging = ref(false);

const percent = computed(() => {
  if (!duration.value || !Number.isFinite(duration.value)) return 0;
  return Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100));
});

// 元数据加载后才有准确的时长
const syncDuration = () => {
  const audio = audioRef.value;
  duration.value = audio && Number.isFinite(audio.duration) ? audio.duration : 0;
};

const onTimeUpdate = () => {
  // 拖动时以指针位置为准，避免进度条来回抖
  if (dragging.value) return;
  currentTime.value = audioRef.value?.currentTime || 0;
};

// 按点击 / 触摸位置换算成播放时间
const seekByEvent = (event) => {
  const bar = progressRef.value;
  const audio = audioRef.value;
  if (!bar || !audio || !duration.value) return;

  const rect = bar.getBoundingClientRect();
  const point = event.touches?.[0] ?? event;
  const ratio = Math.min(1, Math.max(0, (point.clientX - rect.left) / rect.width));
  const time = ratio * duration.value;

  audio.currentTime = time;
  currentTime.value = time;
};

const startDrag = (event) => {
  dragging.value = true;
  seekByEvent(event);
};

const onDragMove = (event) => {
  if (!dragging.value) return;
  seekByEvent(event);
};

const endDrag = () => {
  dragging.value = false;
};

// 音频加载失败（音源失效、防盗链等）
const onAudioError = () => {
  isPlaying.value = false;
  ElMessage({
    message: "当前歌曲无法播放，正在切换下一首",
    grouping: true,
  });
  // 单曲失败时跳到下一首，避免卡死
  if (songs.value.length > 1) {
    setTimeout(next, 800);
  }
};

/* ---------------- 环形频谱 ---------------- */
const spectrumEl = ref(null);
const SPECTRUM_BARS = 36;
let spectrumCtx = null;
let spectrumColor = "#ffffff";

let audioCtx = null;
let analyser = null;
let freqData = null;

// 频谱整体透明度：用缓动逼近目标值，实现淡入淡出
let spectrumAlpha = 0;
let spectrumTarget = 0;
let spectrumRaf = null;

// 接 Web Audio 分析器：必须配合 audio 的 crossorigin="anonymous"，
// 否则拿不到频域数据，而且音频会被安全策略直接静音
const initAnalyser = () => {
  const audio = audioRef.value;
  if (!audio || audioCtx) return;

  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;

  try {
    audioCtx = new Ctx();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;

    const source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    freqData = new Uint8Array(analyser.frequencyBinCount);
  } catch (error) {
    console.warn("频谱初始化失败：", error);
    analyser = null;
  }
};

// 从封面取主色作为频谱颜色
const extractCoverColor = (url) => {
  if (!url) {
    spectrumColor = "#ffffff";
    return;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";

  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 12;
      canvas.height = 12;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 12, 12);

      const { data } = ctx.getImageData(0, 0, 12, 12);
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count += 1;
      }
      if (!count) return;

      r /= count;
      g /= count;
      b /= count;

      // 平均色通常偏灰偏暗：按最亮通道拉到接近满值，
      // 保留色相的同时把颜色提亮，避免频谱发灰看不清
      const peak = Math.max(r, g, b) || 1;
      const boost = 232 / peak;

      spectrumColor = `rgb(${Math.min(255, Math.round(r * boost))}, ${Math.min(
        255,
        Math.round(g * boost),
      )}, ${Math.min(255, Math.round(b * boost))})`;
    } catch (error) {
      spectrumColor = "#ffffff";
    }
  };

  img.onerror = () => {
    spectrumColor = "#ffffff";
  };

  img.src = url;
};

const clearSpectrum = () => {
  const canvas = spectrumEl.value;
  if (!canvas) return;
  if (!spectrumCtx) spectrumCtx = canvas.getContext("2d");
  spectrumCtx?.clearRect(0, 0, canvas.width, canvas.height);
};

const drawSpectrum = () => {
  const canvas = spectrumEl.value;
  if (!canvas) return;

  if (!spectrumCtx) spectrumCtx = canvas.getContext("2d");
  const ctx = spectrumCtx;
  if (!ctx) return;

  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);

  if (!analyser || spectrumAlpha <= 0.01) return;

  analyser.getByteFrequencyData(freqData);

  const cx = size / 2;
  const cy = size / 2;
  // 封面半径约占画布 0.38，频谱紧贴在外圈
  const innerR = size * 0.38;
  const maxLen = size * 0.13;
  const half = SPECTRUM_BARS / 2;

  // 整体透明度：暂停时靠它淡出，而不是瞬间消失
  ctx.globalAlpha = spectrumAlpha;
  ctx.lineCap = "round";
  ctx.lineWidth = size * 0.021;
  ctx.strokeStyle = spectrumColor;
  ctx.shadowColor = spectrumColor;
  ctx.shadowBlur = size * 0.06;

  for (let i = 0; i < SPECTRUM_BARS; i += 1) {
    // 左右镜像取频段，视觉上更对称
    const mirror = i < half ? i : SPECTRUM_BARS - i - 1;
    const bin = Math.floor((mirror / half) * freqData.length * 0.7);
    const value = freqData[bin] / 255;

    const angle = (i / SPECTRUM_BARS) * Math.PI * 2 - Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const len = maxLen * (0.12 + value);

    ctx.beginPath();
    ctx.moveTo(cx + cos * innerR, cy + sin * innerR);
    ctx.lineTo(cx + cos * (innerR + len), cy + sin * (innerR + len));
    ctx.stroke();
  }
};

// 频谱自己的 rAF：播放时淡入，暂停时淡出到 0 再停，
// 单独一个循环是因为暂停后进度循环就停了，淡出还得继续跑
let spectrumLastTime = 0;

const spectrumLoop = (now) => {
  const dt = spectrumLastTime ? Math.min(now - spectrumLastTime, 50) : 16;
  spectrumLastTime = now;

  // 按时间衰减而不是按帧：帧率高的机器上每帧乘系数会让淡出快得看不见
  const k = 1 - Math.exp(-dt / 150);
  spectrumAlpha += (spectrumTarget - spectrumAlpha) * k;

  if (spectrumTarget === 0 && spectrumAlpha < 0.01) {
    spectrumAlpha = 0;
    clearSpectrum();
    spectrumRaf = null;
    spectrumLastTime = 0;
    return;
  }

  drawSpectrum();
  spectrumRaf = requestAnimationFrame(spectrumLoop);
};

const showSpectrum = () => {
  spectrumTarget = 1;
  if (spectrumRaf === null) {
    spectrumLastTime = 0;
    spectrumRaf = requestAnimationFrame(spectrumLoop);
  }
};

const hideSpectrum = () => {
  spectrumTarget = 0;
  if (spectrumRaf === null) {
    spectrumLastTime = 0;
    spectrumRaf = requestAnimationFrame(spectrumLoop);
  }
};

/* ---------------- 进度高频同步 ---------------- */
// timeupdate 只有约 4Hz，卡拉OK填充会一顿一顿，播放时改用 rAF 逐帧同步
let rafId = null;

const stopProgressLoop = () => {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
};

const startProgressLoop = () => {
  if (rafId !== null) return;
  const step = () => {
    rafId = requestAnimationFrame(step);
    const audio = audioRef.value;
    if (audio && !dragging.value) {
      currentTime.value = audio.currentTime || 0;
    }
  };
  rafId = requestAnimationFrame(step);
};

// 播放：进度循环 + 频谱淡入；暂停：停进度，频谱淡出
watch(isPlaying, (playing) => {
  if (playing) {
    startProgressLoop();
    showSpectrum();
  } else {
    stopProgressLoop();
    hideSpectrum();
  }
});

// 打开面板时加载歌单
watch(
  () => store.musicOpenState,
  (open) => {
    if (open) {
      loadSongs();
    } else {
      // 关闭播放器即停止播放，并把进度复位
      listOpen.value = false;
      const audio = audioRef.value;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      currentTime.value = 0;
      isPlaying.value = false;
    }
  },
  { immediate: true },
);

// 进入壁纸展示模式：面板会被 v-if 移除，同时停止播放
watch(
  () => store.backgroundShow,
  (show) => {
    if (!show) return;

    listOpen.value = false;
    volumeOpen.value = false;

    const audio = audioRef.value;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    currentTime.value = 0;
    isPlaying.value = false;
  },
);

// 拖动进度条时指针可能移出播放器，监听全局移动
onMounted(() => {
  window.addEventListener("mousemove", onDragMove);
  window.addEventListener("mouseup", endDrag);
  window.addEventListener("touchmove", onDragMove, { passive: true });
  window.addEventListener("touchend", endDrag);
  // 列表拖动可能移出列表区域，监听全局
  window.addEventListener("pointermove", onListPointerMove);
  window.addEventListener("pointerup", onListPointerUp);
  // 触屏被系统手势打断时也要正常收尾
  window.addEventListener("pointercancel", onListPointerUp);
  // 点击空白处收起歌曲列表
  document.addEventListener("click", handleOutsideClick);
});

onBeforeUnmount(() => {
  stopProgressLoop();
  cancelInertia();
  clearTimeout(volumeTimer);

  // 频谱淡出循环也要停，否则离开后还在跑
  if (spectrumRaf !== null) cancelAnimationFrame(spectrumRaf);
  spectrumRaf = null;
  window.removeEventListener("mousemove", onDragMove);
  window.removeEventListener("mouseup", endDrag);
  window.removeEventListener("touchmove", onDragMove);
  window.removeEventListener("touchend", endDrag);
  window.removeEventListener("pointermove", onListPointerMove);
  window.removeEventListener("pointerup", onListPointerUp);
  window.removeEventListener("pointercancel", onListPointerUp);
  document.removeEventListener("click", handleOutsideClick);
});
</script>

<style lang="scss" scoped>
.player {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 30;
  width: min(640px, 92vw);
  /* 用 margin 居中而不是 translateX：
     祖先若带常驻 transform，backdrop-filter 的采样范围会被限制在该祖先内 */
  margin: 0 auto;
  padding-top: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 滑入 / 滑出 */
.player-drop-enter-active {
  transition:
    transform 0.55s cubic-bezier(0.34, 1.28, 0.64, 1),
    opacity 0.35s ease;
}
.player-drop-leave-active {
  transition:
    transform 0.3s cubic-bezier(0.4, 0, 1, 1),
    opacity 0.25s ease;
}
.player-drop-enter-from,
.player-drop-leave-to {
  transform: translateY(-130%);
  opacity: 0;
}

/* 椭圆长条 */
.bar {
  position: relative;
  width: 100%;
  height: 76px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(18, 18, 20, 0.55);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  /* 提前声明，让浏览器在展开列表前就建好 backdrop 层，避免临时重建 */
  will-change: backdrop-filter;
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow:
    0 18px 40px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);

  .cover-wrap {
    position: relative;
    flex-shrink: 0;
    width: 52px;
    height: 52px;

    .cover {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.12);
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.16);

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        animation: cover-spin 14s linear infinite;
        animation-play-state: paused;

        &.spinning {
          animation-play-state: running;
        }
      }
    }

    /* 频谱画布比封面大一圈，套在外侧；不能放进 .cover 里，会被圆角裁掉 */
    .spectrum {
      position: absolute;
      left: -10px;
      top: -10px;
      width: 72px;
      height: 72px;
      pointer-events: none;
    }
  }

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;

    .name {
      font-size: 15px;
      font-weight: 600;
      color: #fff;
    }

    .lyric {
      position: relative;
      width: 100%;
      font-size: 12px;
      line-height: 1.2;
      letter-spacing: 0.2px;

      /* 卡拉OK：底层暗色文字 + 上层亮色文字按进度裁切
         宽度必须贴合文字本身，否则填充百分比会按整行算，短句会提前填满 */
      .karaoke {
        position: relative;
        display: inline-block;
        max-width: 100%;
        vertical-align: top;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;

        .karaoke-base {
          color: rgb(255 255 255 / 38%);
        }

        .karaoke-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          overflow: hidden;
          white-space: nowrap;
          transition: width 0.12s linear;

          .karaoke-text {
            color: #fff;
            text-shadow: 0 0 10px rgb(255 255 255 / 55%);
          }
        }
      }

      .lyric-tip {
        display: block;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        color: rgb(255 255 255 / 38%);
      }
    }
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-left: 6px;

    .btn {
      position: relative;
      flex-shrink: 0;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 50%;
      background: transparent;
      cursor: pointer;
      color: rgb(255 255 255 / 86%);
      opacity: 0.86;
      transition:
        transform 0.18s ease,
        opacity 0.2s ease,
        color 0.2s ease;

      /* 内联 SVG 图标，尺寸统一 */
      .ico {
        display: block;
        width: 20px;
        height: 20px;
      }

      &:hover {
        opacity: 1;
        color: #fff;
        transform: scale(1.12);
      }
      &:active {
        transform: scale(0.92);
      }

      /* 鼠标点击后 Chrome 会留下焦点环，看起来像多了一个圆底 */
      &:focus {
        outline: none;
      }
      /* 键盘操作时仍保留可见焦点 */
      &:focus-visible {
        outline: 2px solid rgb(255 255 255 / 45%);
        outline-offset: 1px;
      }

      /* 播放键稍大，纯图标不加底色 */
      &.play {
        width: 44px;
        height: 44px;
        margin: 0 3px;
        opacity: 1;

        .ico {
          width: 24px;
          height: 24px;
        }

        &:hover {
          transform: scale(1.15);
        }
      }

      /* 列表按钮 */
      &.list {
        width: 34px;
        height: 34px;
        opacity: 0.75;

        .ico {
          width: 17px;
          height: 17px;
        }

        &:hover,
        &.active {
          opacity: 1;
        }
      }
    }

    /* 分隔线做成独立元素：放在按钮内部会被按下时的 scale 一起带着动 */
    .divider {
      flex-shrink: 0;
      width: 1px;
      height: 16px;
      margin: 0 4px;
      background: rgb(255 255 255 / 18%);
    }
  }

  /* 播放进度条：贴在椭圆底部内侧 */
  .progress {
    position: absolute;
    /* 位置要和封面错开：封面 52px 垂直居中，底边在 y=64，
       进度条轨道中心要压到 65 以下才不会被封面盖住，所以 bottom 取 5
       左右各收 30px，避开椭圆底部逐渐收窄的弧线 */
    left: 30px;
    right: 30px;
    bottom: 5px;
    height: 12px;
    display: flex;
    align-items: center;
    cursor: pointer;
    touch-action: none;

    .progress-track {
      position: relative;
      width: 100%;
      height: 3px;
      border-radius: 2px;
      background: rgb(255 255 255 / 16%);
      overflow: hidden;
    }

    .progress-played {
      height: 100%;
      border-radius: 2px;
      background: rgb(255 255 255 / 90%);
      transition: width 0.12s linear;
    }

    .progress-knob {
      position: absolute;
      top: 50%;
      width: 9px;
      height: 9px;
      margin-left: -4.5px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 4px rgb(0 0 0 / 30%);
      transform: translateY(-50%) scale(0);
      transition:
        transform 0.18s ease,
        left 0.12s linear;
      pointer-events: none;
    }

    &:hover .progress-knob,
    &.dragging .progress-knob {
      transform: translateY(-50%) scale(1);
    }

    /* 拖动时取消过渡，保证跟手 */
    &.dragging {
      .progress-played,
      .progress-knob {
        transition: none;
      }
    }
  }
}

/* 音量框：故意不用 backdrop-filter，动态出现的模糊层会触发背景重采样 */
.volume {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  z-index: 2;
  width: 200px;
  padding: 10px 12px 12px;
  border-radius: 14px;
  background: rgba(22, 23, 27, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.36);
  transform: translateX(-50%);

  .volume-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 9px;
    color: #fff;
  }

  .volume-icon {
    width: 17px;
    height: 17px;
    opacity: 0.9;
  }

  .volume-value {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.3px;
  }

  .volume-track {
    height: 3px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.16);
    overflow: hidden;
  }

  .volume-fill {
    height: 100%;
    border-radius: 3px;
    background: #fff;
    transition: width 0.08s linear;
  }
}

.volume-fade-enter-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.volume-fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.volume-fade-enter-from,
.volume-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -6px);
}

/* 歌曲列表 */
.song-list {
  /* 绝对定位，不参与 .player 的布局：
     否则展开会把容器撑高，导致播放条的 backdrop-filter 重新采样背景而闪一下 */
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  width: 100%;
  padding: 10px;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  border-radius: 24px;
  /* 这里刻意不用 backdrop-filter：它是动态出现的图层，
     展开瞬间会重新采样一次背景，造成背景闪烁，改用高不透明度实色 */
  background: rgba(20, 21, 25, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
  scrollbar-width: none;
  cursor: grab;
  /* 触屏横滑交给自定义拖拽，避免和原生滚动抢手势 */
  touch-action: none;

  &::-webkit-scrollbar {
    display: none;
  }

  /* 拖动中：换成抓手光标，且子项不再接收指针事件，避免误触切歌 */
  &.grabbing {
    cursor: grabbing;
    user-select: none;

    .song {
      pointer-events: none;
    }
  }

  /* 内容层：越界时整体位移，做橡皮筋回弹 */
  .song-track {
    flex: 0 0 auto;
    display: flex;
    gap: 8px;
    width: max-content;
    transform: translateX(var(--over, 0px));

    /* 只有回弹时才加过渡，拖动和惯性滑动期间必须跟手
       曲线不带过冲，回弹是平滑收回去，不会来回抖 */
    &.bouncing {
      transition: transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
  }

  .song {
    flex: 0 0 auto;
    max-width: 190px;
    padding: 8px 16px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: 999px;
    background: rgb(255 255 255 / 6%);
    cursor: pointer;
    animation: song-in 0.4s ease backwards;
    animation-delay: calc(var(--i) * 35ms);
    transition:
      background 0.2s,
      transform 0.2s;

    &:hover {
      background: rgb(255 255 255 / 14%);
      transform: translateY(-2px);
    }

    .song-name {
      font-size: 13px;
      color: #fff;
    }
    .song-artist {
      font-size: 11px;
      color: rgb(255 255 255 / 50%);
    }

    &.active {
      background: rgb(255 255 255 / 92%);

      .song-name {
        color: #17171a;
      }
      .song-artist {
        color: rgb(23 23 26 / 60%);
      }
    }
  }
}

/* 展开：从下方滑入 + 渐显，和收起对称 */
.list-expand-enter-active {
  transition:
    transform 0.32s cubic-bezier(0.25, 0.8, 0.4, 1),
    opacity 0.28s ease;
}
.list-expand-enter-from {
  transform: translateY(20px);
  opacity: 0;
}

/* 收起：整体向上滑出 + 渐隐。
   这里刻意不做 clip-path 过渡——从两侧向中间收窄会在 0.26s 内把内容裁没，
   视觉上就是「啪一下收回」，把上滑和淡出完全盖住了 */
.list-expand-leave-active {
  transition:
    transform 0.3s cubic-bezier(0.25, 0.8, 0.4, 1),
    opacity 0.28s ease;
}
.list-expand-leave-to {
  transform: translateY(-20px);
  opacity: 0;
}

@keyframes cover-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes song-in {
  from {
    opacity: 0;
    transform: translateX(-14px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@media (max-width: 720px) {
  .player {
    padding-top: 14px;
  }

  .bar {
    height: 66px;
    gap: 10px;
    padding: 0 10px;

    .cover-wrap {
      width: 44px;
      height: 44px;

      /* 画布同步缩小，频谱才不会离封面太远 */
      .spectrum {
        width: 64px;
        height: 64px;
      }
    }

    .info {
      .name {
        font-size: 14px;
      }
      .lyric {
        font-size: 11px;
      }
    }

    .controls {
      gap: 0;

      .btn {
        width: 34px;
        height: 34px;

        .ico {
          width: 18px;
          height: 18px;
        }

        &.play {
          width: 40px;
          height: 40px;
          margin: 0 2px;

          .ico {
            width: 22px;
            height: 22px;
          }
        }

        &.list {
          width: 30px;
          height: 30px;

          .ico {
            width: 15px;
            height: 15px;
          }
        }
      }

      .divider {
        height: 14px;
        margin: 0 2px;
      }
    }

    .progress {
      left: 26px;
      right: 26px;
      bottom: 4px;
    }
  }
}
</style>
