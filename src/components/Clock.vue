<template>
  <!-- 传入 src 时回退为静态图片，未传时渲染实时时钟 -->
  <img v-if="src" class="clock" :src="src" alt="logo" />
  <svg
    v-else
    class="clock"
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    :aria-label="`当前时间 ${ariaText}`"
  >
    <defs>
      <!-- 外圈：左上高光、右下阴影，模拟金属边框 -->
      <linearGradient :id="`rim-${uid}`" x1="18%" y1="2%" x2="82%" y2="98%">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="38%" stop-color="#f4f5f7" />
        <stop offset="72%" stop-color="#e2e4e8" />
        <stop offset="100%" stop-color="#bfc3c9" />
      </linearGradient>

      <!-- 表盘：光源偏左上 -->
      <radialGradient :id="`dial-${uid}`" cx="42%" cy="28%" r="82%">
        <stop offset="0%" stop-color="#4d545b" />
        <stop offset="48%" stop-color="#343a40" />
        <stop offset="82%" stop-color="#23272b" />
        <stop offset="100%" stop-color="#1a1d20" />
      </radialGradient>

      <!-- 玻璃反光 -->
      <radialGradient :id="`gloss-${uid}`" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16" />
        <stop offset="70%" stop-color="#ffffff" stop-opacity="0.03" />
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
      </radialGradient>

      <!-- 时针：沿指针方向由亮到暗 -->
      <linearGradient
        :id="`hand-hour-${uid}`"
        gradientUnits="userSpaceOnUse"
        x1="100"
        y1="66"
        x2="100"
        y2="100"
      >
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="100%" stop-color="#d3d8dd" />
      </linearGradient>

      <!-- 分针 -->
      <linearGradient
        :id="`hand-minute-${uid}`"
        gradientUnits="userSpaceOnUse"
        x1="100"
        y1="45"
        x2="100"
        y2="100"
      >
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="100%" stop-color="#d3d8dd" />
      </linearGradient>

      <!-- 秒针 -->
      <linearGradient
        :id="`hand-second-${uid}`"
        gradientUnits="userSpaceOnUse"
        x1="100"
        y1="32"
        x2="100"
        y2="117"
      >
        <stop offset="0%" stop-color="#f0575c" />
        <stop offset="100%" stop-color="#cf3238" />
      </linearGradient>
    </defs>

    <!-- 外圈（加粗） -->
    <circle cx="100" cy="100" r="99" :fill="`url(#rim-${uid})`" />
    <!-- 外圈与表盘之间的凹陷分界 -->
    <circle cx="100" cy="100" r="81" fill="none" stroke="#0d0f11" stroke-opacity="0.55" stroke-width="2.5" />
    <!-- 表盘 -->
    <circle cx="100" cy="100" r="80" :fill="`url(#dial-${uid})`" />
    <!-- 表盘内圈高光，增强玻璃感 -->
    <circle cx="100" cy="100" r="79.5" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1.5" />
    <!-- 玻璃反光 -->
    <ellipse cx="100" cy="54" rx="60" ry="40" :fill="`url(#gloss-${uid})`" />

    <!-- 指针 -->
    <g class="hands">
      <line
        ref="hourRef"
        x1="100"
        y1="100"
        x2="100"
        y2="66"
        :stroke="`url(#hand-hour-${uid})`"
        stroke-width="13"
        stroke-linecap="round"
        :transform="initialTransform.hour"
      />
      <line
        ref="minuteRef"
        x1="100"
        y1="100"
        x2="100"
        y2="45"
        :stroke="`url(#hand-minute-${uid})`"
        stroke-width="10.5"
        stroke-linecap="round"
        :transform="initialTransform.minute"
      />
      <line
        ref="secondRef"
        x1="100"
        y1="117"
        x2="100"
        y2="32"
        :stroke="`url(#hand-second-${uid})`"
        stroke-width="3.5"
        stroke-linecap="round"
        :transform="initialTransform.second"
      />
    </g>

    <!-- 中心轴 -->
    <circle cx="100" cy="100" r="8" fill="#c62a30" />
    <circle cx="100" cy="100" r="6.5" fill="#e5484d" />
    <circle cx="99" cy="98.5" r="2.2" fill="#ffffff" fill-opacity="0.55" />
  </svg>
</template>

<script setup>
// 中国标准时间相对 UTC 的偏移（UTC+8，无夏令时）
const CHINA_OFFSET = 8 * 60 * 60 * 1000;

defineProps({
  // 传入图片地址则显示静态 logo，便于以后换回图片
  src: { type: String, default: "" },
});

// 同一页面存在多个实例时，避免 SVG 内 id 冲突
const uid = `c${Math.random().toString(36).slice(2, 8)}`;

const hourRef = ref(null);
const minuteRef = ref(null);
const secondRef = ref(null);

// 无障碍描述，每秒跟随更新
const ariaText = ref("");

// 计算当前中国时间的指针角度
// 秒取整（整秒跳动），分含秒、时含分，实现逐级联动
const getAngles = () => {
  const date = new Date(Date.now() + CHINA_OFFSET);
  const s = date.getUTCSeconds();
  const m = date.getUTCMinutes() + s / 60;
  const h = (date.getUTCHours() % 12) + m / 60;
  return {
    hour: h * 30,
    minute: m * 6,
    second: s * 6,
    text: `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`,
  };
};

// 初始角度直接用当前时间，首帧即准确，不会先闪到 12 点
const initial = getAngles();
const initialTransform = {
  hour: `rotate(${initial.hour} 100 100)`,
  minute: `rotate(${initial.minute} 100 100)`,
  second: `rotate(${initial.second} 100 100)`,
};
ariaText.value = initial.text;

let rafId = null;
// 上一次渲染所在的整秒，用于只在秒数变化时跳针
let lastSecond = Math.floor((Date.now() + CHINA_OFFSET) / 1000);

const setRotation = (el, deg) => {
  el?.setAttribute("transform", `rotate(${deg} 100 100)`);
};

const render = () => {
  const next = getAngles();
  setRotation(secondRef.value, next.second);
  setRotation(minuteRef.value, next.minute);
  setRotation(hourRef.value, next.hour);
  ariaText.value = next.text;
};

// 每帧只做一次整秒比较，秒数变化才重绘指针（跳秒效果）
// 角度始终由系统时间重算而非累加，长时间运行不会产生偏差
const tick = () => {
  rafId = requestAnimationFrame(tick);

  const second = Math.floor((Date.now() + CHINA_OFFSET) / 1000);
  if (second === lastSecond) return;

  lastSecond = second;
  render();
};

onMounted(() => {
  // 页面加载后立即启动，无需用户操作
  rafId = requestAnimationFrame(tick);
});

onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
});
</script>

<style lang="scss" scoped>
.clock {
  display: block;
  flex-shrink: 0;
  width: 120px;
  height: 120px;
  border-radius: 50%;

  // 整体投影，让表盘从背景中浮起来
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.42));

  // 指针阴影用 CSS 实现：垂直线段的 bbox 宽度为 0，
  // SVG 百分比 filter 区域会被算成 0 宽，导致指针完全不渲染
  .hands {
    filter: drop-shadow(0 1px 1.6px rgba(0, 0, 0, 0.5));
  }

  @media (max-width: 768px) {
    width: 100px;
    height: 100px;
  }
}
</style>
