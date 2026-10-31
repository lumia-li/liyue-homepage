<template>
  <!-- 项目区内容已移除，只保留底部那条小白条 -->
  <div class="github-project">
    <div class="dot-bar" />
  </div>
</template>

<style lang="scss" scoped>
.github-project {
  width: 100%;
  /* 内容区是 flex column，用 auto 把自己推到底部，
     位置和原来分页条在卡片下方时接近 */
  margin-top: auto;
  padding-top: 20px;

  /* 原 swiper 分页器的激活圆点样式：18×4 白色圆角条 */
  .dot-bar {
    width: 18px;
    height: 4px;
    border-radius: 4px;
    background: #fff;
  }
}
</style>
