<script setup lang="ts">
import { usePageData, usePageFrontmatter, useRoutePath } from "vuepress/client";
import { ref, watch } from "vue";

import CommonWrapper from "@theme-hope/components/CommonWrapper";
import HomePage from "@theme-hope/components/HomePage";
import NormalPage from "@theme-hope/components/NormalPage";
import SkipLink from "@theme-hope/components/SkipLink";
import { FadeSlideY } from "@theme-hope/components/transitions/index";

import type { ThemePageFrontmatter } from "vuepress-theme-hope";

const frontmatter = usePageFrontmatter<ThemePageFrontmatter>();
const routePath = useRoutePath();
const page = usePageData();

const sidebarTopArray = [
  `<a href="https://tangyh.top/" target="_blank">
    <img className="no-zoom" height="50px" width="220px" src="/img/sponsor/lamp.png">
  </a>`,
];

const sidebarContent = ref("");

function shuffle(arr) {
  var l = arr.length;
  var index, temp;
  while (l > 0) {
    index = Math.floor(Math.random() * l);
    temp = arr[l - 1];
    arr[l - 1] = arr[index];
    arr[index] = temp;
    l--;
  }
  return arr;
}



function renderSponsor(){
  if (page.value.path.startsWith("/en/")) {
    sidebarContent.value = "";
    return
  } else {
    shuffle(sidebarTopArray);
    sidebarContent.value = `\
    <div style="width:230px;margin:5px auto;">
    ${sidebarTopArray.slice(0, 4).join("\n  ")}
    <br/>
      <span style='float: right;'>
      <a href='/guide/sponsor.html' style='color: var(--vp-c-accent-bg);font-size: 11px;font-weight: bolder;'>成为赞助商</a>
      </span>
    </div>
    `;
  }
}
renderSponsor();
watch(routePath, () => {
  renderSponsor();
});
</script>
<template>
<!--  <SkipLink />-->
  <CommonWrapper>
    <template #default>
      <HomePage v-if="frontmatter.home" />
      <FadeSlideY v-else>
        <NormalPage :key="page.path" />
      </FadeSlideY>
    </template>
    <template v-if="!frontmatter.home" #sidebarTop>
      <div v-html="sidebarContent" />
    </template>
  </CommonWrapper>
</template>
